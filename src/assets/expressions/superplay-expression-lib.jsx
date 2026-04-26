{
  version: "0.4.0",

  controlLayerName: "Cards Controls",

  clamp: function(v, minVal, maxVal) {
    return Math.min(Math.max(v, minVal), maxVal);
  },

  hasTag: function(layer, tag) {
    return layer.name.indexOf(tag) !== -1;
  },

  markerTitleFromComment: function(comment) {
    var parts = String(comment || "").split(/\r\n|\n|\r/);
    return parts.length > 0 ? parts[0] : "";
  },

  markerTitle: function(marker) {
    return this.markerTitleFromComment(marker.comment);
  },

  findMarker: function(layer, comment) {
    if (layer.marker.numKeys < 1) return null;

    for (var i = 1; i <= layer.marker.numKeys; i++) {
      var marker = layer.marker.key(i);
      if (this.markerTitle(marker) === comment) return marker;
    }

    return null;
  },

  findMarkerTime: function(layer, comment) {
    var marker = this.findMarker(layer, comment);
    return marker === null ? null : marker.time;
  },

  findLayerByName: function(comp, layerName) {
    for (var i = 1; i <= comp.numLayers; i++) {
      var layer = comp.layer(i);
      if (layer.name === layerName) return layer;
    }

    return null;
  },

  findSuperplayDataMarker: function(comp) {
    var dataLayer = this.findLayerByName(comp, "superplay-expression-lib.jsx");
    if (dataLayer === null) return null;

    return this.findMarker(dataLayer, "Superplay Data");
  },

  controlSliderNumber: function(comp, sliderName, fallbackValue) {
    var controlLayer = this.findLayerByName(comp, this.controlLayerName);
    if (controlLayer === null) return fallbackValue;

    try {
      var rawValue = controlLayer.effect(sliderName)("Slider").value;
      var numberValue = parseFloat(rawValue);
      return isNaN(numberValue) ? fallbackValue : numberValue;
    } catch (err) {
      return fallbackValue;
    }
  },

  configNumber: function(comp, sliderName, legacyMarkerNames, fallbackValue) {
    var controlValue = this.controlSliderNumber(comp, sliderName, null);
    if (controlValue !== null) return controlValue;

    if (legacyMarkerNames && legacyMarkerNames.length > 0) {
      var dataMarker = this.findSuperplayDataMarker(comp);
      var legacyValue = this.markerParamNumberAliases(dataMarker, legacyMarkerNames, null);
      if (legacyValue !== null) return legacyValue;
    }

    return fallbackValue;
  },

  markerDataText: function(marker) {
    if (marker === null) return "";

    var comment = String(marker.comment || "");
    var lines = comment.split(/\r\n|\n|\r/);
    if (lines.length < 2) return "";

    return lines.slice(1).join("\n");
  },

  markerDataParam: function(marker, name, fallbackValue) {
    var markerData = this.markerDataText(marker);
    if (markerData === "") return fallbackValue;

    try {
      var parsedData = JSON.parse(markerData);
      if (parsedData !== null && parsedData[name] !== undefined) return parsedData[name];
    } catch (jsonErr) {}

    var jsonKey = '"' + name + '":';
    var jsonKeyIndex = markerData.indexOf(jsonKey);
    if (jsonKeyIndex >= 0) {
      var valueStart = jsonKeyIndex + jsonKey.length;
      var valueEnd = markerData.indexOf(",", valueStart);
      if (valueEnd < 0) valueEnd = markerData.indexOf("}", valueStart);
      if (valueEnd >= 0) {
        var rawJsonValue = markerData.substring(valueStart, valueEnd);
        if (rawJsonValue.charAt(0) === '"') {
          return rawJsonValue.substring(1, rawJsonValue.length - 1);
        }

        return rawJsonValue;
      }
    }

    if (markerData.indexOf("spStock|") !== 0) return fallbackValue;

    var parts = markerData.split("|");
    for (var i = 1; i < parts.length; i++) {
      var separatorIndex = parts[i].indexOf(":");
      if (separatorIndex < 0) continue;

      var key = parts[i].substring(0, separatorIndex);
      if (key === name) return parts[i].substring(separatorIndex + 1);
    }

    return fallbackValue;
  },

  markerParam: function(marker, name, fallbackValue) {
    if (marker === null) return fallbackValue;

    var markerDataValue = this.markerDataParam(marker, name, null);
    if (markerDataValue !== null) return markerDataValue;

    return fallbackValue;
  },

  markerParamNumberAliases: function(marker, names, fallbackValue) {
    for (var i = 0; i < names.length; i++) {
      var value = this.markerParamNumber(marker, names[i], null);
      if (value !== null) return value;
    }

    return fallbackValue;
  },

  markerParamNumber: function(marker, name, fallbackValue) {
    var rawValue = this.markerParam(marker, name, fallbackValue);

    if (rawValue === null || rawValue === undefined || rawValue === "") return fallbackValue;

    var numberValue = parseFloat(rawValue);
    return isNaN(numberValue) ? fallbackValue : numberValue;
  },

  valueDistance: function(a, b) {
    if (a.length === undefined || b.length === undefined) {
      return Math.abs(b - a);
    }

    var sum = 0;
    var len = Math.min(a.length, b.length);
    for (var i = 0; i < len; i++) {
      var diff = b[i] - a[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  },

  lerpValue: function(a, b, progress) {
    if (a.length === undefined || b.length === undefined) {
      return a + ((b - a) * progress);
    }

    var out = [];
    var len = Math.min(a.length, b.length);
    for (var i = 0; i < len; i++) {
      out.push(a[i] + ((b[i] - a[i]) * progress));
    }

    return out;
  },

  bezierAt: function(t, p1, p2) {
    var inv = 1 - t;
    return (3 * inv * inv * t * p1) + (3 * inv * t * t * p2) + (t * t * t);
  },

  bezierDerivative: function(t, p1, p2) {
    var inv = 1 - t;
    return (3 * inv * inv * p1) + (6 * inv * t * (p2 - p1)) + (3 * t * t * (1 - p2));
  },

  solveBezierY: function(x, x1, y1, x2, y2) {
    var t = x;

    for (var i = 0; i < 5; i++) {
      var currentX = this.bezierAt(t, x1, x2) - x;
      var d = this.bezierDerivative(t, x1, x2);
      if (Math.abs(d) < 0.0001) break;
      t = this.clamp(t - currentX / d, 0, 1);
    }

    var low = 0;
    var high = 1;
    for (var j = 0; j < 8; j++) {
      var solvedX = this.bezierAt(t, x1, x2);
      if (Math.abs(solvedX - x) < 0.0001) break;
      if (solvedX < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }

    return this.clamp(this.bezierAt(t, y1, y2), 0, 1);
  },

  progress: function(progress, outInfluence, inInfluence, outVelocity, inVelocity, duration, distance) {
    var safeDistance = Math.max(distance, 0.001);
    var safeDuration = Math.max(duration, 0.001);

    var x1 = this.clamp((outInfluence || 0) / 100, 0.001, 0.999);
    var x2 = this.clamp(1 - ((inInfluence || 0) / 100), 0.001, 0.999);

    var outSlope = Math.max(outVelocity || 0, 0) * safeDuration / safeDistance;
    var inSlope = Math.max(inVelocity || 0, 0) * safeDuration / safeDistance;

    var y1 = outSlope * x1;
    var y2 = 1 - (inSlope * (1 - x2));

    return this.solveBezierY(this.clamp(progress, 0, 1), x1, y1, x2, y2);
  },

  animate: function(keys, options) {
    var inputTime = options && options.inputTime !== undefined ? options.inputTime : time;

    if (keys.length < 1) return value;
    if (inputTime <= keys[0].keyTime) return keys[0].keyValue;
    if (inputTime >= keys[keys.length - 1].keyTime) return keys[keys.length - 1].keyValue;

    for (var i = 0; i < keys.length - 1; i++) {
      var a = keys[i];
      var b = keys[i + 1];

      if (inputTime >= a.keyTime && inputTime <= b.keyTime) {
        var duration = b.keyTime - a.keyTime;
        var rawProgress = (inputTime - a.keyTime) / duration;
        var distance = this.valueDistance(a.keyValue, b.keyValue);
        var progress = this.progress(
          rawProgress,
          a.easeOut,
          b.easeIn,
          a.velocityOut,
          b.velocityIn,
          duration,
          distance
        );

        return this.lerpValue(a.keyValue, b.keyValue, progress);
      }
    }

    return keys[keys.length - 1].keyValue;
  },

  findTargetLayer: function(comp) {
    for (var i = 1; i <= comp.numLayers; i++) {
      var layer = comp.layer(i);
      if (this.hasTag(layer, "[TARGET]")) return layer;
    }

    return null;
  },

  findNextStockLayer: function(comp, baseLayer) {
    for (var i = baseLayer.index + 1; i <= comp.numLayers; i++) {
      var layer = comp.layer(i);
      if (this.hasTag(layer, "[STOCK]")) return layer;
    }

    return null;
  },

  stockOrderBelow: function(comp, baseLayer, targetLayer) {
    var order = 0;
    for (var i = baseLayer.index + 1; i <= targetLayer.index; i++) {
      var layer = comp.layer(i);
      if (this.hasTag(layer, "[STOCK]")) order++;
    }

    return order;
  },

  actionOrderAt: function(comp, layerRef, actionTime) {
    var order = 0;
    var tolerance = comp.frameDuration / 10;

    for (var i = 1; i <= comp.numLayers; i++) {
      var layer = comp.layer(i);
      if (layer.marker.numKeys < 1) continue;

      for (var j = 1; j <= layer.marker.numKeys; j++) {
        var marker = layer.marker.key(j);
        var markerTitle = this.markerTitle(marker);
        var isTargetAction = markerTitle === "Jump" || markerTitle === "Flip Stock";
        if (!isTargetAction) continue;

        var isEarlier = marker.time < actionTime;
        var isSameTimeBeforeLayer = Math.abs(marker.time - actionTime) <= tolerance && layer.index <= layerRef.index;
        if (isEarlier || isSameTimeBeforeLayer) order++;
      }
    }

    return Math.max(order, 1);
  },

  stockShiftProgress: function(comp, eventTime, currentTime, order, frameDuration) {
    var shiftDelayFrames = this.configNumber(comp, "Stock Shift Delay Frames", [], 2);
    var shiftDurationFrames = this.configNumber(comp, "Stock Shift Duration Frames", [], 11);
    var startTime = eventTime + (frameDuration * (shiftDelayFrames + order));
    var endTime = startTime + (frameDuration * shiftDurationFrames);

    if (currentTime < startTime) return 0;
    if (currentTime >= endTime) return 1;

    return this.animate([
      { keyTime: startTime, keyValue: 0, easeOut: 75, velocityOut: 0 },
      { keyTime: endTime, keyValue: 1, easeIn: 75, velocityIn: 0 }
    ], { inputTime: currentTime });
  },

  stockEventDistance: function(comp, eventLayer, eventTime) {
    var configuredDistance = this.controlSliderNumber(comp, "Stock Spacing X", null);
    if (configuredDistance !== null && Math.abs(configuredDistance) > 0.0001) return configuredDistance;

    var dataMarker = this.findSuperplayDataMarker(comp);
    var legacyDistance = this.markerParamNumberAliases(dataMarker, ["spacingX", "stockSpacingX", "distanceX"], null);
    if (legacyDistance !== null && Math.abs(legacyDistance) > 0.0001) return legacyDistance;

    var eventMarker = this.findMarker(eventLayer, "Flip Stock");
    var storedDistance = this.markerParamNumberAliases(eventMarker, ["spacingX", "stockSpacingX", "distanceX"], null);
    if (storedDistance !== null && Math.abs(storedDistance) > 0.0001) return storedDistance;

    var nextStockLayer = this.findNextStockLayer(comp, eventLayer);
    if (nextStockLayer === null) return 0;

    var sampleTime = Math.max(0, eventTime - (comp.frameDuration / 2));
    var eventPos = eventLayer.transform.position.valueAtTime(sampleTime);
    var nextPos = nextStockLayer.transform.position.valueAtTime(sampleTime);

    return eventPos[0] - nextPos[0];
  },

  stockShiftOffsetAt: function(comp, layerRef, currentTime) {
    var offsetX = 0;

    for (var i = 1; i < layerRef.index; i++) {
      var layer = comp.layer(i);
      if (!this.hasTag(layer, "[STOCK]")) continue;

      var eventTime = this.findMarkerTime(layer, "Flip Stock");
      if (eventTime === null || eventTime > currentTime) continue;

      var order = this.stockOrderBelow(comp, layer, layerRef);
      if (order < 1) continue;

      var distance = this.stockEventDistance(comp, layer, eventTime);
      offsetX += distance * this.stockShiftProgress(comp, eventTime, currentTime, order, comp.frameDuration);
    }

    return offsetX;
  },

  stockPosition: function(ctx) {
    var layer = ctx.layer;
    var comp = ctx.comp;
    var inputTime = ctx.time;
    var baseValue = ctx.value;

    var flipMarker = this.findMarker(layer, "Flip Stock");
    var flipTime = flipMarker === null ? null : flipMarker.time;
    var baseZ = baseValue.length > 2 ? baseValue[2] : 0;

    if (flipTime === null || inputTime < flipTime) {
      return [baseValue[0] + this.stockShiftOffsetAt(comp, layer, inputTime), baseValue[1], baseZ];
    }

    var targetLayer = this.findTargetLayer(comp);
    var shiftAtFlip = this.stockShiftOffsetAt(comp, layer, flipTime);
    var startPos = [baseValue[0] + shiftAtFlip, baseValue[1], baseZ];
    var targetPos = targetLayer === null
      ? startPos
      : targetLayer.transform.position.valueAtTime(flipTime);

    var targetX = targetPos[0];
    var targetY = targetPos[1];
    var targetZ = targetPos.length > 2 ? targetPos[2] : baseZ;
    var zStep = this.configNumber(comp, "Global Z Step", [], 0.05);
    var arcHeight = this.configNumber(comp, "Stock Arc Height", [], 29);
    var moveMidFrames = this.configNumber(comp, "Stock Move Mid Frames", [], 6);
    var moveEndFrames = this.configNumber(comp, "Stock Move End Frames", [], 11);
    var finalZ = targetZ - (this.actionOrderAt(comp, layer, flipTime) * zStep);
    var diffX = Math.abs(targetX - startPos[0]);

    var midTime = flipTime + (comp.frameDuration * moveMidFrames);
    var endTime = flipTime + (comp.frameDuration * moveEndFrames);
    var midY = startPos[1] + ((targetY - startPos[1]) / 2) - arcHeight;
    var midPos = [startPos[0] + (diffX / 2), midY, finalZ];
    var endPos = [targetX, targetY, finalZ];

    return this.animate([
      { keyTime: flipTime, keyValue: startPos, easeOut: 75, velocityOut: 0 },
      { keyTime: midTime, keyValue: midPos, easeIn: 1.16, velocityIn: 2640, easeOut: 16, velocityOut: 2640 },
      { keyTime: endTime, keyValue: endPos, easeIn: 75, velocityIn: 0 }
    ], { inputTime: inputTime });
  },

  stockFlip: function(ctx) {
    var flipTime = this.findMarkerTime(ctx.layer, "Flip Stock");

    if (flipTime === null || ctx.value === 100) return ctx.value;

    var flipStartFrames = this.configNumber(ctx.comp, "Stock Flip Start Frames", [], 2);
    var flipEndFrames = this.configNumber(ctx.comp, "Stock Flip End Frames", [], 17);
    var firstKeyTime = flipTime + (ctx.comp.frameDuration * flipStartFrames);
    var secondKeyTime = flipTime + (ctx.comp.frameDuration * flipEndFrames);

    if (ctx.time < firstKeyTime) return ctx.value;
    if (ctx.time >= secondKeyTime) return 100;

    var progress = (ctx.time - firstKeyTime) / Math.max(secondKeyTime - firstKeyTime, 0.001);
    return this.lerpValue(0, 100, this.clamp(progress, 0, 1));
  }
}
