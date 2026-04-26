// Creates or updates the Cards Gameplay control layer in the active composition.
// Run this in After Effects: File > Scripts > Run Script File... or paste into the ExtendScript editor.

(function createCardsControls() {
  var controlsLayerName = "Cards Controls";
  var overwriteExistingValues = false;

  var sliders = [
    { name: "Global Z Step", value: 0.05 },
    { name: "Stock Spacing X", value: 0 },
    { name: "Stock Arc Height", value: 29 },
    { name: "Stock Move Mid Frames", value: 6 },
    { name: "Stock Move End Frames", value: 11 },
    { name: "Stock Shift Delay Frames", value: 2 },
    { name: "Stock Shift Duration Frames", value: 11 },
    { name: "Stock Flip Start Frames", value: 2 },
    { name: "Stock Flip End Frames", value: 17 },
    { name: "Progress Delay Frames", value: 5 }
  ];

  function getActiveComp() {
    if (app.project && app.project.activeItem instanceof CompItem) {
      return app.project.activeItem;
    }

    alert("No active composition found.\nPlease open or select a composition and try again.");
    return null;
  }

  function findLayerByName(comp, layerName) {
    for (var i = 1; i <= comp.numLayers; i++) {
      if (comp.layer(i).name === layerName) return comp.layer(i);
    }

    return null;
  }

  function findEffectByName(layer, effectName) {
    var effects = layer.property("ADBE Effect Parade");
    if (!effects) return null;

    for (var i = 1; i <= effects.numProperties; i++) {
      var effect = effects.property(i);
      if (effect && effect.name === effectName) return effect;
    }

    return null;
  }

  function ensureSlider(layer, sliderName, sliderValue) {
    var effects = layer.property("ADBE Effect Parade");
    var effect = findEffectByName(layer, sliderName);

    if (!effect) {
      effect = effects.addProperty("ADBE Slider Control");
      effect.name = sliderName;
      effect.property("ADBE Slider Control-0001").setValue(sliderValue);
      return;
    }

    var slider = effect.property("ADBE Slider Control-0001");
    if (slider && overwriteExistingValues) {
      slider.setValue(sliderValue);
    }
  }

  app.beginUndoGroup("Create Cards Controls");

  try {
    var comp = getActiveComp();
    if (!comp) return;

    var controlsLayer = findLayerByName(comp, controlsLayerName);

    if (!controlsLayer) {
      controlsLayer = comp.layers.addNull();
      controlsLayer.name = controlsLayerName;
      controlsLayer.label = 14;
      controlsLayer.guideLayer = true;
      controlsLayer.shy = true;
      controlsLayer.enabled = true;
      controlsLayer.threeDLayer = false;
      controlsLayer.moveToEnd();
    }

    var wasLocked = controlsLayer.locked;
    controlsLayer.locked = false;

    for (var i = 0; i < sliders.length; i++) {
      ensureSlider(controlsLayer, sliders[i].name, sliders[i].value);
    }

    controlsLayer.guideLayer = true;
    controlsLayer.shy = true;
    controlsLayer.selected = false;
    controlsLayer.locked = true;
    comp.hideShyLayers = true;

    alert("Cards Controls is ready.");
  } catch (err) {
    alert("Could not create Cards Controls:\n" + err.toString());
  } finally {
    app.endUndoGroup();
  }
})();
