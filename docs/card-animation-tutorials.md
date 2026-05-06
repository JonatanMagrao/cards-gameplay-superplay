# Cards Gameplay Tutorial Videos

Goal: keep the tutorial series short, practical, and easy to update. Target length: up to 2 minutes per video.

## 01 - Getting Started: Settings, Assets, and Updates

Main sequence:

- Open the Cards Gameplay panel.
- Open Settings.
- Show Assets Path, Levels Path, Tutorials Path, and Cache Path.
- Hover labels to reveal full paths.
- Use Open and Change buttons.
- Explain which shared-drive folders should be available offline.
- Show where update banners appear.
- Show release notes/updates from the flyout menu when available.
- Mention what users should not rename inside the assets folder.

Voiceover script:

Before using Cards Gameplay, make sure the extension knows where your shared files live.

Open Settings and check the main paths. Assets Path points to the shared assets used by the tool: presets, cards, VFX, SFX, expressions, and the After Effects project assets. Levels Path is where saved layouts live. Tutorials Path is where local tutorial videos are loaded from. Cache Path is your local copy of the layout library, used to make browsing faster.

You can hover each label to see the full path, use Open to inspect the folder, or Change to point the extension somewhere else.

For daily work, the most important folders to keep available offline in Google Drive are assets, levels, and video-tutorials. The extension-releases folder is optional for offline work; it is only used when checking for available updates.

If a newer version is available, the panel will show an update banner at the top. You can also use the flyout menu to view version notes when release text files are available.

One important rule: do not rename required files or precomps inside the assets folder. The tool expects specific names so it can import and rebuild things correctly.

## 02 - Card Manager: Add, Change, and Turn Cards

Main sequence:

- Choose a suit.
- Choose a rank.
- Show the card preview updating.
- Ctrl+click the preview to add a card.
- Select an existing card layer.
- Click the preview to change the card face.
- Use Turn on selected cards.
- Show automatic layer naming and labels.

Voiceover script:

The Card Manager is where you create and edit card faces.

Start by choosing a suit and a rank. The preview updates immediately, so you can confirm the exact card before adding it to the comp.

To add a new card, hold Control and click the card preview. The extension imports the required card assets if needed and adds the card to the active composition. Just make sure a composition is open before doing this.

You can also update existing cards. Select one or more card layers, choose a new suit or rank, and click the preview without holding Control. The selected layers will update to the new card face.

Whenever a card is created or changed, the tool keeps the layer name organized with the suit and rank. This makes the timeline easier to read later, especially when a layout has many cards.

If you need to show the back of a card, select the layers and click Turn. You can turn one card or many cards at the same time.

## 03 - Building Layouts: Duplicate, Arrange, and Setup Tags

Main sequence:

- Add or select a starter card.
- Set number of copies.
- Use Duplicate.
- Adjust X and Y spacing.
- Use sliders and inputs.
- Toggle Order/reverse behavior.
- Set Target.
- Set Stock.
- Set Tableau.
- Show colors and name tags in the timeline.

Voiceover script:

After creating a card, the next step is building the layout.

Select a card, choose how many copies you need, and click Duplicate. The extension creates the copies and keeps them arranged according to the current X and Y spacing values.

You can adjust spacing with the input fields or the sliders. This works before duplicating, and it also works after duplication if you select the cards you want to redistribute.

The Order toggle changes which side of the selected stack behaves like the anchor. Use it when you need the spacing to grow from the opposite direction.

Once the cards are positioned, tag them for gameplay. Use Set Target for the target card, Set Stock for stock cards, and Set Tableau for tableau cards. These buttons set the layer color, enable 3D, and add the required name tags such as [TARGET], [STOCK], or [TABLEAU].

Only one target layer is allowed per composition. If a target already exists, the tool will warn you before creating another one.

Best practice: build and save a clean layout before running gameplay animations.

## 04 - Layout Library: Apply, Save, and Update Levels

Main sequence:

- Search layouts in the input/dropdown.
- Show layout preview.
- Show tags and description.
- Apply a layout.
- Apply a different layout over an existing level and show confirmation.
- Save a new level.
- Save over an existing level and show confirmation.
- Show description and tags in the save dialog.
- Explain resolutions and cache refresh.

Voiceover script:

The Layouts panel is your shared level library.

Use the search field or dropdown to find a level. The preview, description, tags, and source resolution help you confirm that you are choosing the right layout. Click Apply to place it in the active composition.

If the active comp already has a managed level and you choose a different one, the extension asks for confirmation before replacing it. This helps prevent accidentally writing one level over another.

Saving works as both create and update. If the level does not exist yet, Save creates it. If a matching level already exists, the tool asks before overwriting it. The save dialog lets you set the level name, tags, and description.

Layouts are saved by resolution. If a level has multiple resolutions, the extension uses the best match for the active composition.

The layout stores card names, labels, position, scale, rotation, Z depth, card face options, stacking order, and gameplay markers. It does not save arbitrary manual animation as a reliable layout state.

If someone else adds or updates a level, refresh the local cache so your panel can see the latest files.

## 05 - Gameplay Actions: Flip, Jump, Flip Stock, Progress Bar, and Restore

Main sequence:

- Select a card and apply Flip.
- Set a Target layer.
- Select Tableau card and apply Jump.
- Select Stock card and apply Flip Stock.
- Add Progress Bar.
- Show markers in the timeline.
- Use Reset.
- Use Restore.
- Show FX Precomp generated by the tool.

Voiceover script:

Gameplay actions are driven by markers.

Flip adds a standard flip action to selected cards. Jump moves a card toward the target, so a Target layer must exist before using it. Flip Stock is designed for stock cards and also depends on the target.

When you apply Jump or Flip Stock, the extension creates the needed expressions, controls, SFX, VFX, and markers. The markers are important because they describe what happened and when it happened.

The Progress Bar reads Jump markers from the target composition and updates automatically as the gameplay timeline advances.

Reset removes tool-generated animation, expressions, and effects from the card layers, but keeps the markers. Restore uses those markers to rebuild the animation. This is useful when you need to clean up, repair a comp, or recreate the animation after applying a saved layout.

The FX Precomp is generated and managed by the tool. It contains audio and visual effects created by gameplay actions. Do not treat it as a manual work area, because reset and restore workflows may rebuild it.

## 06 - Custom VFX and Troubleshooting

Main sequence:

- Open Back VFX and Front VFX precomps.
- Show guide layers.
- Replace or add custom artwork/VFX.
- Drag custom precomp into Essential Properties.
- Replace Back Card.
- Replace Special Card.
- Use Wild Card to preview special front replacement.
- Mention Rotation versus Orientation.
- Show common fixes: missing target, wrong depth, assets missing.

Voiceover script:

The VFX precomps are creative sandboxes for custom card visuals.

Open the Back VFX or Front VFX precomp. These comps use the same card frame and alignment, so you can replace artwork, add animation, or build visual effects without editing the original card masters.

When the custom design is ready, go back to the card layer and open its Essential Properties. Drag your custom VFX precomp into the slot you want to replace.

Use Back Card to change the back of the card. Use Special Card to change the front replacement. To see the Special Card replacement, choose the Wild Card option in the Card Manager. The panel preview may not show the custom wild card, but the layer in After Effects will render correctly.

For troubleshooting, keep a few rules in mind. Use Rotation, not Orientation, for normal card adjustments. If a card appears behind another one, check Z depth and restore the animation if needed. If Jump or Flip Stock does not work, confirm that a Target layer exists. If assets are missing, check the Assets Path and make sure the shared-drive files are available.
