import type { DirectAIProvider } from "@/lib/model-channel";
import { apimartDirectProtocol } from "./apimart";
import { arkDirectProtocol } from "./ark";
import { autodlDirectProtocol } from "./autodl";
import { comfyUIDirectProtocol } from "./comfyui";
import { kieDirectProtocol } from "./kie";
import type { DirectProtocolAdapter } from "./types";

export const directProtocolAdapters: Readonly<Record<DirectAIProvider, DirectProtocolAdapter>> = {
    kie: kieDirectProtocol,
    apimart: apimartDirectProtocol,
    autodl: autodlDirectProtocol,
    comfyui: comfyUIDirectProtocol,
    ark: arkDirectProtocol,
};
