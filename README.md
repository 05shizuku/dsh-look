# dsh-look · 视觉 consent

**默认不看，主动看必留痕，可拒绝。**

视觉不该是每轮自动睁眼的管道，而该是主动伸头的动作。agent 要看屏幕时显式调用 screenshot 等工具，每一次看都在转录里留痕。本插件管理这套视觉 consent 的开关；截屏能力本身由 dsh-orb 等工具提供。

## 功能

- `look_mode`：查询或切换被动屏幕视觉。
  - 无参数：只查询，不修改。
  - `action: "off"`：创建旗标，关闭每轮自动附图，转为仅主动看。
  - `action: "on"`：删除旗标，恢复每轮自动附图。
- 旗标文件的生死就是开关，切换后无需重启。
- dsh-orb 缺席时仍可管理旗标，但本插件不提供截屏能力，会礼貌降级。

## 组成与依赖

1. **本插件**：注册 `look_mode`，管理 `first-frame-off.json`。
2. **dsh-orb 钩子补丁**：让宿主在被动附图前检查旗标；只跳过被动首帧，不改变用户主动 lasso 截图。
3. **重建脚本**：`tools/rebuild-firstframe-patch.ps1`。dsh-orb 更新覆盖补丁后重跑；幂等、写前备份、写后语法检查。

> 仅安装 dsh-look 而不打钩子补丁时，工具仍能查询和切换旗标，但宿主不会因此停止被动附图。完整功能需要两者配合。

## 安装

```sh
dsh plugin --profile <profile> add "link:<本目录绝对路径>"
```

安装后重启 DSH。补丁目标示例（按实际 profile 调整）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/rebuild-firstframe-patch.ps1 `
  -OrbIndexPath "<profile>\node_modules\dsh-orb\dist\computer-use\index.js" `
  -NodePath "<path\to\node.exe>"
```

补丁生效需要重启或重载 dsh-orb；之后切换旗标无需重启。

## 旗标路径

按以下优先级解析，公开源码不包含任何本机绝对路径：

1. `DSH_LOOK_FLAG_FILE`：旗标文件完整路径；设置后只使用该路径。
2. `DSH_HOME`：DSH 数据根目录；设置后使用 `<DSH_HOME>/dsh-orb/first-frame-off.json`，便于便携安装和隔离测试。
3. 包根目录的 `dsh-look.local.json`：本地私有配置，已被 `.gitignore` 排除。复制 `dsh-look.example.json` 并修改 `flagPath` 即可。
4. 默认：`~/.dsh/dsh-orb/first-frame-off.json`。

## 测试

```sh
node --test
```

测试覆盖：双向切换、重复切换、BOM 旗标、非法 JSON 的输出兼容、显式路径优先级。测试全部在临时目录进行，不读写真实旗标。

## 兼容与边界

- `engines.dsh`：`>=0.1.7-rc.2 <0.3.0-0`；`node >=20`。
- 补丁锚点按 dsh-orb 0.2.1 的构建产物编写；上游结构变化时脚本会拒绝继续，需人工核对，不盲目改写。
- 被动看关闭后，GUI 工具仍可使用，但模型需要先主动截屏获得坐标参照。这是设计的一部分：看与动都应是显式动作。
- `private: true` 是为了避免误发 npm；GitHub 源码发布不受影响。

## 生态声明

本包独立维护，作为识海生态的兼容件：命名与配置约定对齐，视觉记录走转录标准路径，不造私有记忆格式。关于视觉的誓约属于识海账本，本包只实现机制。

## v0.1.1

- 修复带 BOM 旗标解析及空 meta 输出。
- 修复无旗标时无法关闭、恢复时未删除旗标的问题。
- `DSH_HOME` 改为隔离权威路径，避免测试或便携配置误触真实开关。
- 增加自动化测试、双语元数据、原创 SVG 图标和通用补丁重建脚本。

MIT License · 05shizuku and Amikar
