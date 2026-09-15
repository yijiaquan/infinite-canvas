import argparse
import collections
import datetime
import json
import math
import pathlib
import shutil
import sqlite3
import urllib.parse


def encode(value):
    return urllib.parse.quote(str(value or ""), safe="-_.!~*'()")


def main():
    parser = argparse.ArgumentParser(description="Merge identical drama reference nodes inside each Clip.")
    parser.add_argument("--database", required=True)
    parser.add_argument("--canvas-id", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    database = pathlib.Path(args.database).resolve()
    connection = sqlite3.connect(database)
    row = connection.execute(
        "SELECT user_id, drama_revision, project_data FROM canvas_projects WHERE id = ? AND deleted_at = ''",
        (args.canvas_id,),
    ).fetchone()
    if not row:
        raise RuntimeError("Canvas was not found")

    user_id, table_revision, raw = row
    canvas = json.loads(raw)
    json_revision = canvas.get("dramaRevision", 0)
    if table_revision != json_revision:
        raise RuntimeError(f"Revision mismatch before migration: table={table_revision}, json={json_revision}")

    nodes = canvas.get("nodes", [])
    edges = canvas.get("connections", [])
    original_node_count = len(nodes)
    original_edge_count = len(edges)
    node_by_id = {node["id"]: node for node in nodes}
    if len(node_by_id) != len(nodes):
        raise RuntimeError("Duplicate node IDs found")

    reference_groups = collections.defaultdict(list)
    for node in nodes:
        metadata = node.get("metadata") or {}
        if metadata.get("dramaRole") == "reference" and metadata.get("dramaAssetVersionId"):
            reference_groups[(metadata.get("dramaClipId"), metadata["dramaAssetVersionId"])].append(node)

    replacement = {}
    duplicate_sets = 0
    for candidates in reference_groups.values():
        if len(candidates) < 2:
            continue
        signatures = {(node.get("type"), (node.get("metadata") or {}).get("storageKey")) for node in candidates}
        if len(signatures) != 1:
            raise RuntimeError("A shared asset version resolves to different media; migration stopped")
        duplicate_sets += 1
        canonical = next(
            (node for node in candidates if str((node.get("metadata") or {}).get("dramaBindingTarget", "")).endswith(":storyboard")),
            candidates[0],
        )
        for node in candidates:
            if node is not canonical:
                replacement[node["id"]] = canonical["id"]

    migrated_edges = []
    seen_generated = set()
    for edge in edges:
        original_source = node_by_id.get(edge.get("fromNodeId"))
        source_metadata = (original_source or {}).get("metadata") or {}
        migrated = dict(edge)
        migrated["fromNodeId"] = replacement.get(edge.get("fromNodeId"), edge.get("fromNodeId"))
        generated = bool(edge.get("dramaAssetVersionId")) or (
            source_metadata.get("dramaRole") == "reference"
            and source_metadata.get("dramaBindingTarget") == edge.get("toNodeId")
            and edge.get("id") == f'{edge.get("fromNodeId")}:binding'
        )
        if generated:
            version_id = edge.get("dramaAssetVersionId") or source_metadata.get("dramaAssetVersionId")
            role = edge.get("dramaInputRole") or source_metadata.get("dramaInputRole")
            order = edge.get("dramaInputOrder", source_metadata.get("dramaInputOrder"))
            speaker = edge.get("dramaInputSpeaker")
            if speaker is None and role == "voice":
                try:
                    speaker = urllib.parse.unquote(edge.get("fromNodeId", "").rsplit(":", 1)[-1]) or None
                except ValueError:
                    speaker = None
            key = (migrated["fromNodeId"], edge.get("toNodeId"), version_id, role, speaker or "")
            if key in seen_generated:
                continue
            seen_generated.add(key)
            migrated.update(
                {
                    "id": f'drama:binding:{encode(edge.get("toNodeId"))}:{encode(version_id)}:{encode(role)}:{encode(speaker)}',
                    "dramaAssetVersionId": version_id,
                    "dramaInputRole": role,
                    "dramaInputOrder": order,
                }
            )
            if speaker:
                migrated["dramaInputSpeaker"] = speaker
            else:
                migrated.pop("dramaInputSpeaker", None)
        migrated_edges.append(migrated)

    if len({edge["id"] for edge in migrated_edges}) != len(migrated_edges):
        raise RuntimeError("Connection ID collision after migration")

    nodes = [node for node in nodes if node["id"] not in replacement]
    for node in nodes:
        metadata = node.get("metadata") or {}
        if metadata.get("dramaRole") == "reference":
            for key in ("dramaBindingTarget", "dramaInputRole", "dramaInputOrder"):
                metadata.pop(key, None)

    edge_orders = collections.defaultdict(list)
    for edge in migrated_edges:
        if edge.get("dramaAssetVersionId"):
            edge_orders[edge["fromNodeId"]].append(edge.get("dramaInputOrder", 10**9))

    top = 0
    for clip_id in canvas.get("dramaPreparedClipIds", []):
        clip_nodes = [node for node in nodes if (node.get("metadata") or {}).get("dramaClipId") == clip_id]
        group = next((node for node in clip_nodes if (node.get("metadata") or {}).get("dramaRole") == "group"), None)
        if not group:
            continue
        refs = [node for node in clip_nodes if (node.get("metadata") or {}).get("dramaRole") == "reference"]
        refs.sort(key=lambda node: ({"image": 0, "video": 1, "audio": 2}.get(node.get("type"), 3), min(edge_orders.get(node["id"], [10**9])), node.get("title", "")))
        rows = math.ceil(len(refs) / 3) if refs else 0
        group["position"] = {"x": 0, "y": top}
        group["width"] = 740
        group["height"] = 330 + rows * 180 if refs else 300
        for node in clip_nodes:
            role = (node.get("metadata") or {}).get("dramaRole")
            if role == "storyboard":
                node["position"] = {"x": 24, "y": top + 60}
            elif role == "video":
                node["position"] = {"x": 396, "y": top + 60}
            elif role == "reference":
                index = refs.index(node)
                node["position"] = {"x": 24 + (index % 3) * 236, "y": top + 300 + (index // 3) * 180}
        top += group["height"] + 160

    canvas["nodes"] = nodes
    canvas["connections"] = migrated_edges
    canvas["dramaRevision"] = table_revision + 1
    canvas["updatedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    targets_by_source = collections.defaultdict(set)
    for edge in migrated_edges:
        if edge.get("dramaAssetVersionId"):
            targets_by_source[edge["fromNodeId"]].add(edge["toNodeId"])
    report = {
        "canvasId": args.canvas_id,
        "revisionBefore": table_revision,
        "revisionAfter": table_revision + 1,
        "duplicateSets": duplicate_sets,
        "nodesBefore": original_node_count,
        "nodesAfter": len(nodes),
        "connectionsBefore": original_edge_count,
        "connectionsAfter": len(migrated_edges),
        "referencesSharedAcrossTargets": sum(1 for values in targets_by_source.values() if len(values) > 1),
    }

    if args.apply:
        stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        backup = database.with_name(f"{database.stem}.before-shared-refs.{stamp}{database.suffix}")
        connection.close()
        shutil.copy2(database, backup)
        connection = sqlite3.connect(database)
        connection.execute("BEGIN IMMEDIATE")
        cursor = connection.execute(
            "UPDATE canvas_projects SET project_data = ?, drama_revision = ?, updated_at = ? WHERE user_id = ? AND id = ? AND drama_revision = ?",
            (json.dumps(canvas, ensure_ascii=False, separators=(",", ":")), table_revision + 1, canvas["updatedAt"], user_id, args.canvas_id, table_revision),
        )
        if cursor.rowcount != 1:
            connection.rollback()
            raise RuntimeError("Canvas changed during migration; backup retained and no update committed")
        connection.commit()
        report["backup"] = str(backup)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
