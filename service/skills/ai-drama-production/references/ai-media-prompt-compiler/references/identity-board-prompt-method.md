# Identity Board Prompt Method

Use this reference for a normal `Character + Look` identity-board request. It compiles one current character specification into one provider request and one complete artistic multi-view identity-board image. Technical reproduction may record the raw request under `ComfyUI输出`, but no separate contract is required.

## Non-negotiable production definition

- `generation_strategy=single_generated_board` is the only route for a new formal identity board.
- One Character ID plus one Look ID equals one request and one complete generated board.
- The complete board has two internal production zones: a smaller neck-down body-construction zone and a larger multi-view head-identity zone. They are not separate generated assets.
- Never generate 7–10 standalone views and stitch them into a board. That output is a QA contact sheet, not an identity board.
- Preserve the whole generated board as identity authority. Crops extracted from it are downstream reference derivatives only. Its neutral poses and expressions are not downstream Shot-performance authority.
- If wardrobe, hair/makeup, age, injury, transformation, contamination, or another persistent visual state changes materially, create a new versioned Look ID and generate one new complete board.
- If the whole board fails identity consistency, coverage, readability, or composition, revise the prompt and generate a new whole-board version. Do not silently fall back to a multi-request leaf pipeline.

## Prompt template

Compile the actual provider prompt from this complete structure. Replace every bracketed field with the approved character specification; do not shorten it into generic quality words.

```text
创建一张艺术性的角色身份板。使用参考图像中的 [角色名称 / Character ID / Look ID] 作为唯一固定主体。

背景为纯白色、柔和米白色或能与人物轮廓清晰分离的浅中性色。无环境、无场景叙事、无剧情道具、无 Logo、无水印。

设计方向：不要创建死板的目录式角色参考表。创建一张电影般的身份板，使其像高端动画工作室的角色研究与艺术书布局的结合。布局不对称、优雅且视觉上令人难忘；使用大片留白、多样但清晰可读的图像比例和有意的不平衡。避免机械网格、蓝图设计、重复视角和拥挤排版。

重要布局规则：所有角色研究都属于同一个人、同一个 Look。整板明确分为两个不重叠的区域，区域之间保留明显留白；不得堆叠人物、合并姿势、共享肢体或生成额外人物。身体结构区不裁剪手、脚、四肢或服装关键结构；头部身份区不裁剪面部、下巴、耳朵、发际线或发型轮廓；负责研究的部位不得被遮挡。

主要构图分区：

1. 身体结构区，占整板约 35%–40%。只展示颈根/肩线以下至脚部，不出现头部和面部。以中性正面、侧面、背面和三分之四身体视角为主，清楚呈现肩宽、躯干、四肢、手、鞋靴、服装层次、穿法、固定配件、体型比例和轮廓。颈根处是干净、中性、无创伤的制作裁切；不得出现伤口、血液、骨骼、断面、斩首或任何暴力暗示。身体研究必须共享同一颈宽、肤色、体型和服装，不因无头展示而变成假人、盔甲架或不同身体。

2. 头部身份区，占整板约 60%–65%，并作为视觉主区。默认严格只展示 3 个大尺寸头部或头肩视图：
   - 正面主视图：占头部区约一半面积，是整张身份板最大的面部，完整呈现双眼、眉形、鼻口、下颌、耳朵、发际线、皮肤标记和发型外轮廓；
   - 3/4 视图：清楚呈现面部纵深、颧骨、鼻梁、下颌和发型侧面结构；
   - 侧面视图：清楚呈现额头、鼻唇、下巴、耳朵、后脑和发型轮廓。

不重复生成左右两套 3/4 或左右两套侧面，不默认添加后脑头像、五官局部头像或额外小头像。若角色存在只能由特殊后方发型或头部结构识别的事实，用该必要角度替换侧面视图，不新增第 4 个头部。三个头部保持同一基础中性、放松表情，只为识别五官和头型服务，不制作夸张情绪序列，不替代表演板。

只保留本 Look 实际生产需要的研究，不为凑数量增加无用姿势。两个区域必须能被模型明确理解为同一角色的头部与身体，而不是两个不同人物。

身份锁定：所有研究严格保持相同脸型与五官比例、相同年龄、相同肤色与皮肤特征、相同发型和发色、相同颈部宽度、相同身体比例、相同固定服装鞋靴与穿戴配件和相同轮廓。头部区与身体区的肤色、颈肩接口、年龄、体型和 Look 必须能够自然重组为同一个完整人物。板内的中性姿态与基础表情仅用于识别范围，不得成为后续 Shot 必须复制的固定姿态或表情。禁止变脸、重新设计人物、改变服装结构、改变体型或生成第二套身份。

角色具体身份：[填写脸型、五官间距、年龄范围、肤色、发型轮廓、身高体型、固定服装、鞋靴、配件、稳定轮廓习惯、禁止漂移项]。身份板中的中性站姿、目光和细微表情只用于清楚展示身份，不定义该角色在剧情 Shot 中的姿态、视线、情绪或表演强度。

造型材质与色彩：清楚呈现本 Look 的[服装层次、剪裁和穿法]；[主色]与[次色]保持稳定，[布料/皮革/金属/饰物]呈现准确的纹理、厚薄、反射和磨损程度。材质、颜色和配件只服务同一 Look 的复用，不因艺术装饰改造服装结构，也不混入另一时期的状态。

识别友好光线：使用[主光方向、高度、软硬与色温]，让脸部结构、发际、服装层次、身体轮廓、手部和固定配件都可比较；阴影不得吞没身份锚点或把同一人物的不同研究照成不同外貌。背景保持[纯白 / 柔和米白 / 浅中性]，不引入环境故事、剧情光源或叙事道具。

制作可用性：头部身份区必须比身体区更大、更清晰，并把有限空间集中给 3 个大头部，尤其保证正面主视图具有最高有效像素；面部形状、五官比例、发际线、发型轮廓、耳朵、下颌和稳定皮肤特征必须足以供后续模型识别。身体结构区必须让服装轮廓、身体形状、手部、鞋靴、比例和配件清晰可辨。每项研究必须像独立、干净的角色研究，不得像剧情场景截帧。

艺术性部分：可在身体结构区加入 2–3 个不含头部的简化黑色身体轮廓，并可设一个小型服装与固定配件细节区域。头部身份区不再加入额外眼睛、鼻口、发型或表情小图，全部空间优先保证 3 个主头部足够大。不要加入会与独立人物表演板混淆的情绪序列。所有部分仍须保持同一身份。

文本设计：预留简约、醒目、艺术导向的 Character ID 区块，仅包含 [名称]、[角色]、[核心情绪]、[视觉标志]。如果当前模型已验证可稳定生成这些文字，可以直接呈现；否则保持清晰空白区，后期确定性添加准确文字。少量编辑箭头或标注只能服务识别，不得遮挡人物。

整体风格：[项目批准的视觉媒介与年代风格]；简约、电影感、高端、艺术书般、干净、适用于制作。最终图像应是一张由模型一次生成的完整艺术身份板，以大尺寸多视角头部稳定面部身份，以颈根以下身体研究稳定体型、服装和轮廓，而不是由多张独立图片拼接成的联系表。
```

## Look versioning

Keep the same Character ID when the person remains the same. Create a new Look ID when a persistent visible state would otherwise cause conflicting identity guidance, including:

- wardrobe or footwear change;
- materially different hair, makeup, age presentation, injury, contamination, transformation, or disguise;
- a story phase whose silhouette or fixed worn accessories change.

Do not create a new Look ID for a momentary expression, hand gesture, camera angle, or temporary action. Those belong inside the existing board or the Shot specification.

## Post-generation handling

1. QA the whole image and each study region for identity consistency, coverage, separation, crop completeness, hands, readability, and unwanted duplicates.
2. Correct exact Character ID text and minimal labels deterministically only when needed; do not rearrange separately generated people into a new board.
3. The accepted whole board is the only normal character asset. It enters later static director-board generation as the identity reference and is not converted into a separate single-view H3 input. Never extract the headless body zone as a character-identity input. If real H3 media QA finds identity drift, repair the affected complete director-board Panel with the accepted whole board rather than generating another routine character asset.
4. Never call a deterministic contact sheet, QA gallery, or collection of independent leaves the formal identity board.
5. When a project needs stable nuanced acting language, create a separate performance board from the accepted identity board. Do not expand the identity board into the Shot-performance authority.

## QA rejection conditions

Reject the board for identity drift, wardrobe drift within the same Look, changed proportions, inconsistent head/body skin tone or neck interface, more than three default head studies, repeated mirrored head angles, a front hero face that is not clearly the largest, a head zone that is too small for facial identification, missing front/3-4/profile coverage, cropped face/chin/ears/hair outline, missing hands/feet or clothing structure in the body zone, violent or anatomical injury imagery at the neck crop, duplicate people mistaken for multiple identities, merged bodies, unreadable studies, overcrowded layout, scene storytelling, unrelated props, or a result that visibly looks like unrelated images pasted into a grid.
