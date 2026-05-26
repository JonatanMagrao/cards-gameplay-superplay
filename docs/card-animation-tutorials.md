# Cards Gameplay Tutorial Videos

Elevenlabs Voice: Mark - Natural

Goal: keep the tutorial series short, practical, and easy to update. Target length: up to 2 minutes for the main videos and 1 to 2 minutes for each deep dive.

Audience: motion designers using the extension in After Effects. Focus on visible actions, expected results, and production habits. Avoid implementation details.

Branching: the main path is `01` to `06`. Deep dives use numbers like `02.1`, `04.1`, and `04.2` so they can be watched only when motion designers need that workflow.

Voice generation notes: these scripts are written for screen-recorded tutorials with voiceover only. For ElevenLabs, use a calm instructional voice, medium stability, high similarity, style exaggeration at zero, and normal or slightly slower speed. Keep button names exactly as written in the interface.

## 01 - Getting Started: Settings, Assets, Tutorials, and Updates

Video file: `01-start.mp4`

Main sequence:

- Open the Cards Gameplay panel.
- Open Settings.
- Show Entry Point.
- Show derived Assets Path, Levels Path, Tutorials Path, and Cache Path.
- Show expected Assets Path on screen: `Creative_Marketing_Assets/GENERAL-ASSETS/Plugins/Cards Gameplay/assets`.
- Hover labels to reveal full paths.
- Use Open on the derived folders.
- Use Change or Set on Entry Point.
- Show Cache Path and Refresh local layouts cache.
- Explain which shared-drive folders should be available offline.
- Open the flyout menu.
- Show Tutorials menu.
- Show release notes or update information from the flyout menu when available.
- Mention what users should not rename inside the assets folder.

Voiceover script:

Before using Cards Gameplay, make sure the extension knows where the shared files live.
Open Settings, and start with the Entry Point. This is the shared drive root used by the extension.
From that one Entry Point, Cards Gameplay finds the Assets Path, the Levels Path, the Tutorials Path, and the release folders.
Assets Path should point to the Cards Gameplay assets folder inside the shared drive.
It contains the files the tool needs to work. That includes card assets, presets, V F X, S F X, expressions, progress bar assets, and the After Effects project assets.
Levels Path is the shared layout library. Tutorials Path is where local tutorial videos are loaded from. Cache Path is your local copy of the layout library, used to make browsing faster.
You can hover a label to check the full path. Use Open to inspect a folder. If the Entry Point is wrong, use Change, and select the correct shared drive root.
For daily production, keep assets, levels, and video-tutorials available offline in Google Drive. Extension releases are useful for updates, but they are not required for day-to-day animation work. 
The flyout menu contains tutorials and version information. Tutorial videos appear here when local video files are found in the Tutorials Path.
One important rule: do not rename required files, folders, or precomps inside the assets folder. The tool expects specific names, so it can import and rebuild the scene correctly.

## 02 - Card Manager: Add, Change, Turn, and Coin Value

Video file: `02-cards.mp4`

Main sequence:

- Choose a suit.
- Choose a rank.
- Show the card preview updating.
- Ctrl+click the preview to add a card.
- Select an existing card layer.
- Click the preview to change the selected card face.
- Use Turn on selected cards.
- Show automatic layer naming and labels.
- Point to the coin value selector.
- Explain that Jump coin values are normally assigned automatically.
- Use Set only when a generated Jump needs a manual coin correction.

Voiceover script:

The Card Manager is where you create and edit card faces.
Start by choosing a suit and a rank. The preview updates immediately, so you can confirm the exact card before adding it to the composition.
To add a new card, hold Control and click the card preview.
The extension imports the required card assets if needed, and adds the card to the active composition.
To update an existing card, select one or more card layers. Choose a new suit or rank, and click the preview without holding Control. The selected layers update to the new face.
Whenever a card is created or changed, the tool keeps the layer name organized with the suit and rank. If the layer already has a gameplay tag, that tag stays in the layer name.
If you need to show the back of a card, select the layers and click Turn. This works on one card, or on many selected cards.
Jump coin values are normally assigned automatically by the tool.
Use the coin selector only when a generated Jump needs a manual correction.
To correct one Jump, select the Tableau card with the Jump marker. Choose the coin value, and click Set.

## 02.1 - Deep Dive: Plus Numbers, Wild, and Special Cards

Video file: `02.1-plus-wild.mp4`

Main sequence:

- Choose Plus in the rank dropdown.
- Show that the suit dropdown is disabled for Plus and Wild.
- Ctrl+click the preview to add a Plus card.
- Select the Plus layer in After Effects.
- Open Essential Properties.
- Show the custom Number Control slider.
- Keyframe the custom Number Control slider to animate the Plus number.
- Preview the number changing on the Plus card.
- Choose Wild in the rank dropdown.
- Show that Wild is a regular deck card option called Wild Card.
- Apply Wild to a selected card.
- Explain that the default Wild artwork is not driven by Number Control.
- Mention that animated Wild numbers require a custom Special Card precomp.

Voiceover script:

Plus and Wild are both selected from the Card Manager, but they are not built the same way.
Plus is a dedicated special card asset. Choose Plus, then Control click the preview to add it to the composition.
Plus and Wild are not suit-specific, so the suit dropdown is disabled for both options.
After adding Plus, select the layer in After Effects, and open Essential Properties. Plus exposes a custom Number Control slider.
The number does not animate automatically. Motion designers still need to animate this slider manually.
Add keyframes to Number Control just like any other After Effects slider. The visible number on the Plus card follows that value.
This is where you create a count-up, a quick value change, or a final number reveal.
Wild is different. Wild is applied through the regular deck card system as option 14. Choose Wild and click the preview to apply the Wild Card face to a selected card.
The default Wild artwork is a card face replacement image. It does not expose the same Number Control that Plus has, so there is no built-in Wild number slider to animate.
If a Wild card needs animated numbers, build that animation as a custom Special Card precomp. Then assign it through the custom V F X workflow.
In that case, the animation lives inside the custom precomp, not in the default Wild Card option.
Use Plus when you need the dedicated Plus card and animated number control. Use Wild when the card should remain part of the normal card system and show a special Wild face.

## 03 - Building Layouts: Add Cards, Arrange, and Setup Tags

Video file: `03-layouts.mp4`

Main sequence:

- Start from an empty comp or a cleared level.
- Add the card faces from the Card Manager with Ctrl+click on the preview.
- Adjust scale, position, rotation, and spacing.
- Use simple duplication when useful: After Effects Ctrl+D for identical layers, or Control click the preview again to add another chosen card.
- Open Actions, then the Setup tab.
- Introduce Set Target, Set Stock, and Set Tableau.
- Select the card that should become the target.
- Set Target.
- Select the Tableau cards.
- Set Tableau.
- Select or create the first Stock card.
- Set Stock.
- Use Duplicate Cards when building a stock pile from a prepared stock card.
- Adjust X and Y spacing with inputs or sliders.
- Toggle Order or reverse behavior while redistributing selected stock cards.
- Check the card sequence stack: Tableau cards above, stock piles in the middle, target as the last card in that sequence.
- Show colors and name tags in the timeline.
- Explain that the Setup buttons allow only one target, but manual layer duplication can still duplicate an already tagged target layer.

Voiceover script:

After creating a card, the next step is building the layout.
Start with the card faces you need for the board.
In the Card Manager, choose a suit and rank. Then Control click the preview to add the card to the active composition.
Add the cards first, then adjust the layout: scale, position, rotation, spacing, and any other layout details.
For simple repeated cards, you can use regular After Effects duplication with Control D. This keeps the duplicated layer's current setup, so it is useful after you have a card roughly where you want it.
There is no required order for setting card types. You can tag Tableau, Stock, and Target in whatever order makes sense while building.
The order that does matter is the card sequence stack: Tableau cards above, stock piles in the middle, and the target as the last card in that sequence.
Open Actions, then choose the Setup tab.
The Setup tab contains Set Target, Set Stock, and Set Tableau.
Select the playable Tableau cards, and click Set Tableau.
Select the stock or pile cards, and click Set Stock.
Select the card that should become the target, and click Set Target.
The target should be the card layer that represents the board destination. The Setup action allows only one target through the tool, so if a target already exists, the tool warns you and stops.
Just remember that manual duplication in After Effects can still duplicate an already tagged target layer, because that happens outside the Setup action.
After one stock card is prepared, Duplicate Cards can help build the stock pile faster.
Choose how many copies the pile needs, then click Duplicate.
The extension creates the copies and arranges them using the current X and Y spacing values.
Adjust spacing with the input fields or sliders. The Order toggle changes which side of the selected stack behaves like the anchor when you redistribute selected cards.
Use it when the stock pile needs to grow from the opposite direction.
At the end of this step, the board should be readable: target, tableau, stock pile, colors, layer names, and layer order all clear in the timeline.

## 04 - Play Actions: Flip, Jump, Flip Stock, and Cards Superplay Jump

Video file: `04-play-tab.mp4`

Main sequence:

- Open Actions, then the Play tab.
- Select a card and apply Flip.
- Set a Target layer.
- Select a Tableau card and apply Jump.
- Show the Cards Superplay Jump effect on the jumped card.
- Select a Stock card and apply Flip Stock.
- Mention that Jump, Flip Stock, and Restore use the Trim Covered Cards preference.
- Show markers in the timeline.
- Show FX Precomp generated by the tool.

Voiceover script:

Gameplay actions are driven by markers.
Open Actions, then choose the Play tab. This is where Flip, Jump, and Flip Stock live.
Flip adds a standard flip action to selected cards.
Jump moves a card toward the target, so a Target layer must exist before using it.
When you apply Jump, the extension adds the Cards Superplay Jump effect to the card.
The Cards Superplay Jump effect contains the local Jump controls for that card. We will explore these controls in the next deep dive.
Flip Stock is designed for stock cards, and it also depends on the target.
When you apply Jump or Flip Stock, the extension creates the needed expressions, S F X, V F X, controls, and markers.
Jump, Flip Stock, and Restore also follow the Trim Covered Cards preference from Settings.
The markers are important. They describe what happened, and when it happened.
The F X Precomp is generated and managed by the tool. It contains audio and visual effects created by gameplay actions.

## 04.1 - Deep Dive: Cards Superplay Jump

Video file: `04.1-jump.mp4`

Main sequence:

- Select a Tableau card with a Jump marker.
- Open its effects.
- Show Cards Superplay Jump.
- Group the controls visually into Jump behavior and Target Layer controls.
- Show Jump Duration, Jump Height, Jump Curve Shape, Rotation Cycles, Z Depth Offset, and bounce controls as the Jump behavior group.
- Explain that Rotation Cycles controls spin amount, while negative values reverse the automatic spin direction.
- Preview a small Jump Height or duration adjustment.
- Show Target Layer, Target Offset, and Target Offset Angle as the Target Layer group.
- Preview a small Target Offset adjustment.
- Explain that Target Layer is assigned by the tool, but can be overridden for another card or 3D layer.
- Use Restore to rebuild if the Jump behavior needs to be repaired.

Voiceover script:

Cards Superplay Jump is the local control effect for a Jump card.
You will find it on a card after applying Jump from the Play tab.
Most of the controls are direct motion controls, so think of them in two groups.
The first group is Jump behavior.
Jump Height and Jump Curve Shape control the arc of the jump.
Bounce Amplitude, Bounce Frequency, and Bounce Decay control the landing reaction.
Rotation Cycles controls how much the card spins while moving.
By default, this value is positive, and the tool uses the target's position in the composition to choose the spin direction automatically.
Use a negative Rotation Cycles value only when you want to reverse that automatic direction.
Z Depth Offset is a manual depth adjustment for that jumped card.
Jump Duration controls how long the move takes.
Use these controls when the jump needs to feel faster, heavier, higher, softer, or more readable in depth.
The second group is Target Layer behavior.
Target Layer is the layer the Jump follows.
The tool assigns Target Layer automatically when Jump is applied.
You can override it for special cases and point the Jump to another card, or even another 3D layer, because the motion follows that layer's 3D position.
Target Offset moves the landing point away from the target center.
Target Offset Angle controls the direction of that offset around the target.
Use Target Offset and Target Offset Angle when the card should land above, below, or beside the target instead of directly centered.
Target Layer overrides can be useful for exceptions, but Restore can rebuild the action from markers and the current target setup.
If a Jump starts behaving strangely, run Restore before doing deeper manual repairs.

## 04.2 - Maintenance Tab: Reset, Restore, Clear Expressions, and Group Cards

Video file: `04.2-maintenance-tab.mp4`

Main sequence:

- Start from a comp with Jump, Flip, and Flip Stock actions.
- Show action markers on card layers.
- Show FX Precomp.
- Open Actions, then the Maint. tab.
- Mention that Progress Bar has its own dedicated walkthrough.
- Show Clear Expressions.
- Show Group Cards.
- Use Reset.
- Show that generated animation is removed.
- Show that markers remain.
- Use Restore.
- Show rebuilt motion, SFX, VFX, and FX Precomp.

Voiceover script:

The Maintenance tab, labeled Maint in the interface, contains repair and utility actions.
Progress Bar also lives here, but it has its own dedicated walkthrough.
For general maintenance, focus on Clear Expressions, Group Cards, Reset, and Restore.

Clear Expressions is specific. Use it only when you want to remove expressions from selected layers.
Group Cards creates a shared card group control and parents card layers to it, which is useful when a whole board needs to be moved or scaled together.
Reset removes tool-generated animation, expressions, and generated F X content. It keeps the card effects and action markers.
Restore uses those markers to rebuild the animation.
Restore recreates the expressions, generated S F X, V F X, F X Precomp content, Cards Controls, and gameplay behavior.
The main rule is simple: markers are your rebuild instructions. Keep them if you want Restore to bring the action back.

## 04.3 - Setup Controls: Cards Controls and Trim Covered Cards

Video file: `04.3-setup-controls.mp4`

Main sequence:

- Start from a comp with Jump, Flip, and Flip Stock actions.
- Show Settings, then Timeline, then Trim Covered Cards.
- Explain when Trim Covered Cards should stay on or be turned off.
- Show Cards Controls layer generated by the tool.
- Open its effects.
- Show the Cards Gameplay Control effect.
- Explain Global Z Step.
- Show Stock Spacing X and other global controls more generally.
- Show Clear Level from the Actions toolbar.
- Explain that Clear Level removes the managed layout when the comp should be emptied.
- Mention that missing controls can be repaired by running gameplay actions or Restore.

Voiceover script:

Trim Covered Cards is a Timeline preference in Settings.
When it is enabled, the tool trims card out-points after another card covers them during Jump, Flip Stock, or Restore.
This keeps gameplay timelines cleaner and prevents covered cards from staying visible longer than needed.
Turn it off when you need to keep every card layer visible for manual timing checks or custom edits.

Cards Controls is the central control layer for expression-driven gameplay behavior.
You usually do not need to create it manually. The extension creates or repairs it when gameplay actions need it.
Open its effects and look for Cards Gameplay Control.
These controls are used by the expressions that drive card behavior.
The most important global control to understand is Global Z Step.
Global Z Step controls how much depth separation is added as gameplay actions progress.
Use small changes when jumped cards need clearer depth separation.
The other controls are mostly global helpers for expression behavior.
For example, Stock Arc Height controls the height of the arc when stock cards move during Flip Stock.
Clear Level is for starting over from a managed layout.
Use it when the current comp should be emptied of the level that was applied or built through the tool.
It is safer than manually deleting random layers from the timeline, because it targets the managed layout workflow.
If Cards Controls is missing or looks incomplete, run a gameplay action or Restore. The tool can recreate the required controls from the current setup and markers.

## 04.4 - Progress Bar: Comp Ref, Delay, and Percentage

Video file: `04.4-progress-bar.mp4`

Main sequence:

- Open Actions, then the Maint. tab.
- Add Progress Bar with no layer selected and show that it reads the current composition.
- Select a gameplay precomp layer and add Progress Bar again.
- Show that Comp Ref is assigned automatically from the selected precomp layer.
- Show that the Progress Bar start time follows the selected layer start time.
- Show the Progress Bar layer and its controls.
- Show Comp Ref, Progress Delay Frames, Animation Progress, Start Percent, and End Percent.
- Show Progress Percentage text layer.
- Preview a change to Progress Delay Frames.
- Preview Start Percent and End Percent with a limited range, such as 10 to 90.
- Explain that Animation Progress controls the timing curve for each progress step.

Voiceover script:

Use Progress Bar when the scene needs visual progress feedback.
If the Progress Bar is added inside the gameplay composition, it reads that same composition by default.
It scans Tableau layers for Jump markers, then advances as those markers pass in time.
The tool also creates a Progress Percentage text layer.
This text is parented to the Progress Bar and reads the Bar Control value from the progress bar layer.
It rounds the current value and displays it as a percentage.
This is a technical guide layer for motion designers only. It is not exported in the final video, so you can delete it if the scene does not need a visible percentage readout.

If you are adding the Progress Bar outside the gameplay composition, you can select the gameplay precomp layer before clicking Progress Bar.
When a valid precomp layer is selected, the tool uses that selected layer as the Comp Ref automatically.
It also places the Progress Bar at the selected layer start time, so the timing lines up with the nested gameplay.
If Comp Ref points to a normal footage layer instead of a precomp, the Progress Bar cannot read the markers.

Open the Progress Bar layer effects to check the setup.
Comp Ref tells the bar which composition to read. Leave it empty when the bar lives inside the gameplay comp. Use it when the bar is outside, reading a nested gameplay precomp.
Progress Delay Frames controls how many frames the bar waits after each Jump marker before updating.
For example, use a small delay when the bar should react almost immediately, or a longer delay when the jump needs to land before the progress changes.
Animation Progress controls the timing curve of each step. It does not set the final percentage by itself. It shapes how each update moves from one value to the next. In most cases, leave it unchanged unless the progress motion needs a custom timing feel.
Start Percent and End Percent define the range the bar can travel.
The default range is usually zero to one hundred. Use a range like ten to ninety when the design should never look completely empty or completely full.
Each Jump marker divides that range into equal steps.
For example, if the range is zero to one hundred and the scene has four Jump markers, each jump advances the bar by twenty-five percent.



## 04.5 - Deep Dive: Coin VFX and Jump Feedback

Video file: `04.5-coins.mp4`

Main sequence:

- Show the coin value selector in the Card Manager.
- Select a Tableau card.
- Apply Jump from Actions, then the Play tab.
- Show the generated Coin VFX layer in FX Precomp.
- Apply several Jump actions and show the automatic coin value sequence.
- Show sequential jump SFX variation.
- Select an existing Jump setup.
- Change the coin value and click Set for a manual exception.
- Show the updated marker or visual result.
- Mention what belongs in FX Precomp and what should not be edited manually.

Voiceover script:

Coin value controls the visual feedback for Jump, but normal Jump actions do not need manual coin selection.
The tool assigns coin values automatically from the available coin files.
Select a Tableau card. Open Actions, choose the Play tab, and click Jump.
The extension adds the motion, the Jump marker, the coin V F X, and the S F X.
The generated visual and audio layers live inside the F X Precomp.
If you apply multiple Jumps, the tool advances through the coin value sequence automatically.
It also cycles through the available Jump S F X variations, so the scene does not sound identical every time.
After Flip Stock, the Jump feedback sequence starts again.
Use the coin selector only for exceptions. If a generated Jump needs a different coin value, select that Tableau card, choose the new value, and click Set.
Then preview the action again.
Treat the F X Precomp as generated output. It is useful to inspect, but it is not the best place for permanent manual design work.
Reset and Restore may rebuild it.
After a Restore, preview any manual coin exceptions. Reapply Set if a coin correction needs to be restored.
If a coin V F X is missing, check Assets Path first. The coin files live in the shared assets folder, and must be available locally.

## 05 - Layout Library: Apply, Save, Favorite, and Update Levels

Video file: `05-library.mp4`

Main sequence:

- Search layouts in the input or dropdown.
- Show favorites in the dropdown.
- Favorite and unfavorite one layout.
- Show layout preview.
- Click the preview to open it.
- Show description and tags.
- Apply a layout.
- Apply a different layout over an existing level and show confirmation.
- Save a new level.
- Save over an existing level and show confirmation.
- Show description and tags in the save dialog.
- Show the required level name format: `000-000_Name`, for example `018-011_NewWorld`.
- Explain that saved layouts can be clean or can include gameplay markers.
- Refresh the local cache.
- Show what to check when the library looks stale or a preview is missing.
- Explain stored source resolution.

Voiceover script:

The Layouts panel is your shared level library.
Use the search field or dropdown to find a level. Favorites appear with a star, so important layouts are easier to find during production.
Favorites are local browsing preferences. They help your panel, but they do not change the shared layout.
The preview, description, tags, and source resolution help you confirm that you are choosing the right layout.
Click the preview if you need to inspect it more closely.
Click Apply to place the selected layout in the active composition.
If the active composition already has a managed level, and you choose a different one, the extension asks for confirmation before replacing it.
This helps prevent accidentally writing one level over another.
Saving works as both create and update. If the level does not exist yet, Save creates it. If a matching level already exists, the tool asks before overwriting it.
The Save dialog lets you set the level name, tags, and description.
Level names must use this format: three digits, dash, three digits, underscore, then the level name. For example: zero one eight, dash, zero one one, underscore, New World.
Do not use spaces in the level name. Use letters, numbers, or underscores after the first underscore.
Use these fields for motion-friendly searching. Add the campaign name, mechanic, theme, resolution, or any production label that helps the next motion designer find the layout.
The saved layout can be neutral, before gameplay actions, or it can already include action markers.
Saving before actions gives you a clean board. Saving after actions keeps markers such as Jump, Flip, and Flip Stock, which can be useful because Restore can rebuild generated animation from those markers.
Each saved layout stores the source composition resolution.
Current layouts use one main layout file.
When the layout resolution is different from the active composition, the extension can auto-fit the layout as it applies it.
If someone else adds or updates a level, refresh the local cache so your panel can see the latest files.
If a preview is missing, the layout can still be useful, but be more careful before applying it.
Check the name, description, tags, and resolution. If the library looks stale, refresh the cache first.
If it still looks wrong, check Settings. Confirm that Levels Path and Cache Path are pointing to the expected folders.

## 06 - Custom VFX and Card Artwork

Video file: `06-custom-art.mp4`

Main sequence:

- Open Back VFX and Front VFX precomps.
- Show guide layers.
- Replace or add custom artwork or VFX.
- Keep artwork aligned to the card frame.
- Drag a custom precomp into Essential Properties.
- Replace Back Card.
- Replace Special Card.
- Use Wild Card to preview special front replacement.
- Mention that the panel preview may not show custom special artwork.
- Preview in the After Effects comp.

Voiceover script:

The V F X precomps are creative sandboxes for custom card visuals.
Open the Back V F X or Front V F X precomp.
These compositions use the same card frame and alignment, so you can replace artwork, add animation, or build visual effects without editing the original card masters.
Keep guide layers visible while lining up artwork. They help you stay inside the card frame and avoid surprises when the card flips or moves.
When the custom design is ready, go back to the card layer and open its Essential Properties.
Drag your custom V F X precomp into the slot you want to replace.
Use Back Card to change the card back. Use Special Card to change the special front replacement.
To see the Special Card replacement, choose Wild Card in the Card Manager.
The panel preview may still show the default wild card image, but the layer in After Effects should render the custom result.
For animated numbers, separate the two workflows.
Plus has Number Control on the Plus card layer. Wild does not have a built-in number control.
Animated Wild numbers should be created inside a custom Special Card precomp.

## 06.1 - Deep Dive: Troubleshooting Common Production Issues

Video file: `06.1-troubleshooting.mp4`

Main sequence:

- Show a quick checklist comp.
- Try Jump without a Target and show the warning.
- Open Actions, then the Setup tab.
- Set Target and retry Jump from the Play tab.
- Show a card behind another card and fix Z depth.
- Show Rotation versus Orientation.
- Show a stale layout list and refresh cache.
- Show missing tutorial videos in the flyout and check Tutorials Path.
- Show missing assets warning and check Assets Path.
- Use Reset and Restore to repair generated animation.
- Use Clear Level from the Actions toolbar when the comp should be emptied of the managed layout.
- End with the shortest checklist.

Voiceover script:

Most production issues can be solved with a short checklist.
If Jump or Flip Stock does not work, check the target first.
A Target layer must exist before those actions can run.
Use the Setup tab to set the target, stock, and tableau tags. Use the Play tab for Flip, Jump, and Flip Stock. Use the Maintenance tab, labeled Maint in the interface, for Reset, Restore, Clear Expressions, and Group Cards. Progress Bar also lives there, but it has its own dedicated walkthrough.
If a card appears behind the wrong card, check Z depth and try to adjust it.
For normal card adjustments, use Rotation instead of Orientation.
If the layout list looks old, refresh the local layouts cache.
The shared library may have changed, but your local cache still needs to update.
If tutorials do not appear in the flyout menu, check Tutorials Path in Settings. Confirm that the video files are local and available offline.
If assets are missing, check Assets Path. The extension needs the shared assets folder for cards, presets, expressions, S F X, V F X, and progress bar files.
If generated animation looks broken, use Reset, and then Restore.
Reset removes generated animation while keeping markers. Restore rebuilds the scene from those markers.
If you need to start over with a managed level, use Clear Level from the Actions toolbar. That is safer than manually deleting random layers from the timeline.
The shortest checklist is: Target, tags, Z depth, assets, cache, markers, then Restore.
