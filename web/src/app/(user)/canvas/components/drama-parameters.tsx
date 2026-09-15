"use client";
import { Form, Input, InputNumber, Select } from "antd";
export function DramaParameters({ value = {}, onChange, label }: { value?: Record<string, string | number | boolean>; onChange: (value: Record<string, string | number | boolean>) => void; label: string }) {
    const change = (key: string, next: string | number | null) => {
        const updated = { ...value };
        if (next === null || next === "") delete updated[key];
        else updated[key] = next;
        onChange(updated);
    };
    return (
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
            <Form.Item label="步数">
                <InputNumber aria-label={`${label}步数`} className="!w-full" min={1} max={1000} precision={0} placeholder="沿用上级设置" value={typeof value.steps === "number" ? value.steps : null} onChange={(n) => change("steps", n)} />
            </Form.Item>
            <Form.Item label="种子">
                <InputNumber aria-label={`${label}种子`} className="!w-full" min={0} max={Number.MAX_SAFE_INTEGER} precision={0} placeholder="沿用上级设置" value={typeof value.seed === "number" ? value.seed : null} onChange={(n) => change("seed", n)} />
            </Form.Item>
            <Form.Item label="时长（秒）">
                <InputNumber aria-label={`${label}时长`} className="!w-full" min={0.1} precision={3} placeholder="沿用上级设置" value={typeof value.seconds === "number" ? value.seconds : null} onChange={(n) => change("seconds", n)} />
            </Form.Item>
            <Form.Item label="尺寸">
                <Input aria-label={`${label}尺寸`} value={String(value.size || "")} placeholder="沿用上级设置" onChange={(e) => change("size", e.target.value)} />
            </Form.Item>
            <Form.Item label="分辨率">
                <Select<string>
                    aria-label={`${label}分辨率`}
                    allowClear
                    value={typeof value.resolution_name === "string" ? value.resolution_name : undefined}
                    placeholder="沿用上级设置"
                    options={["480p", "720p", "1080p"].map((v) => ({ value: v, label: v }))}
                    onChange={(v) => change("resolution_name", v || null)}
                />
            </Form.Item>
        </div>
    );
}
