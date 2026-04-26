export const expPos = `
try {
    const jumpMarkerTime = thisLayer.marker.key("Jump").time;
        
    const control = effect("Cards Gameplay Superplay");
    const jumpDurationFrames = control("Jump Duration").value;

    if (jumpDurationFrames <= 0) {
        value;
    } else {
        const jumpHeight = control("Jump Height").value;
        const jumpCurveShape = control("Jump Curve Shape").value;
        const bounceAmplitude = control("Bounce Amplitude").value;
        const bounceFrequency = control("Bounce Frequency").value;
        const bounceDecay = control("Bounce Decay").value;
        const zDepthOffset = control("Z Depth Offset").value;
        const zStep = 0.05;

        const targetLayer = control("Target Layer");
        const targetOffset = control("Target Offset").value;
        const targetOffsetAngle = control("Target Offset Angle").value;

        const jumpTime = framesToTime(jumpDurationFrames);
        const endTime = jumpMarkerTime + jumpTime;

        const rad = degreesToRadians(targetOffsetAngle - 90);
        const offsetX = Math.cos(rad) * targetOffset;
        const offsetY = Math.sin(rad) * targetOffset;

        const getActionOrderAt = function(actionTime) {
            let order = 0;
            const tolerance = thisComp.frameDuration / 10;

            for (let i = 1; i <= thisComp.numLayers; i++) {
                const layer = thisComp.layer(i);
                if (layer.marker.numKeys < 1) continue;

                for (let j = 1; j <= layer.marker.numKeys; j++) {
                    const marker = layer.marker.key(j);
                    const isTargetAction = marker.comment === "Jump" || marker.comment === "Flip Stock";
                    if (!isTargetAction) continue;

                    const isEarlier = marker.time < actionTime;
                    const isSameTimeBeforeLayer = Math.abs(marker.time - actionTime) <= tolerance && layer.index <= thisLayer.index;
                    if (isEarlier || isSameTimeBeforeLayer) order++;
                }
            }

            return Math.max(order, 1);
        };

        const zOffset = -(getActionOrderAt(jumpMarkerTime) * zStep);

        if (time < jumpMarkerTime) {
            value; 
        } else if (time >= jumpMarkerTime && time < endTime) {
            const startPos = thisProperty.valueAtTime(jumpMarkerTime); 
            const rawTargetPos = targetLayer.transform.position.valueAtTime(time);
            
            const targetPos = [rawTargetPos[0] + offsetX, rawTargetPos[1] + offsetY, rawTargetPos[2]];
            
            const progress = linear(time, jumpMarkerTime, endTime, 0, 1);
            
            const currentX = linear(progress, 0, 1, startPos[0], targetPos[0]);
            const currentY = linear(progress, 0, 1, startPos[1], targetPos[1]);
            
            const baseArc = Math.sin(progress * Math.PI);
            const adjustedArc = Math.pow(baseArc, jumpCurveShape) * jumpHeight; 
            
            [currentX, currentY - adjustedArc, targetPos[2] + zOffset + zDepthOffset];
            
        } else {
            const landingTime = time - endTime;
            const rawTargetPos = targetLayer.transform.position.valueAtTime(time);
            const targetPos = [rawTargetPos[0] + offsetX, rawTargetPos[1] + offsetY, rawTargetPos[2]];
            
            const bounce = Math.sin(landingTime * bounceFrequency * Math.PI * 2) * bounceAmplitude * Math.exp(-landingTime * bounceDecay);
                
            [targetPos[0], targetPos[1] + bounce, targetPos[2] + zOffset + zDepthOffset];
        }
    }
} catch (err) {
    value;
}
`

export const expScale = `
try {
    const jumpMarkerTime = thisLayer.marker.key("Jump").time;
    
    const control = effect("Pseudo/cards_gameplay_superplay");
    const jumpDurationFrames = control("Jump Duration").value;

    if (jumpDurationFrames <= 0) {
        value; 
    } else {
        const jumpTime = framesToTime(jumpDurationFrames);
        const endTime = jumpMarkerTime + jumpTime;
        const anticipationStart = jumpMarkerTime - framesToTime(4);

        if (time < anticipationStart) {
            value; 
        } else if (time >= anticipationStart && time <= endTime) {
            // Lê a escala base e calcula o alvo apenas durante o tempo do pulo
            const startScale = thisProperty.valueAtTime(anticipationStart); 
            
            const targetScale = startScale.length === 3 
                ? [startScale[0] * 0.8, startScale[1] * 0.8, startScale[2]] 
                : [startScale[0] * 0.8, startScale[1] * 0.8];

            if (time < jumpMarkerTime) {
                const t = ease(time, anticipationStart, jumpMarkerTime, 0, 1);
                linear(t, 0, 1, startScale, targetScale);
            } else {
                const t = linear(time, jumpMarkerTime, endTime, 0, 1);
                linear(t, 0, 1, targetScale, startScale);
            }
        } else {
            value; 
        }
    }
} catch (err) {
    value;
}
`

export const expRot = `
try {
    const jumpMarkerTime = thisLayer.marker.key("Jump").time;
    
    const control = effect("Pseudo/cards_gameplay_superplay");
    const jumpDurationFrames = control("Jump Duration").value;

    if (jumpDurationFrames <= 0) {
        value; 
    } else {
        if (time < jumpMarkerTime) {
            value; 
        } else {
            // Avaliação preguiçosa: só lê camadas e direções se a carta já estiver pulando/pousada
            const targetLayer = control("Target Layer");
            const spinDegrees = control("Rotation Cycles").value;
            
            const startX = transform.position.valueAtTime(jumpMarkerTime)[0];
            const targetX = targetLayer.transform.position.valueAtTime(jumpMarkerTime)[0];
            
            const dir = startX > targetX ? -1 : 1; 
            const giroFinal = spinDegrees * dir;
            
            const jumpTime = framesToTime(jumpDurationFrames);
            const endTime = jumpMarkerTime + jumpTime;
            const targetRot = targetLayer.transform.zRotation.valueAtTime(time);

            if (time <= endTime) {
                const progress = linear(time, jumpMarkerTime, endTime, 0, 1);
                const startRot = thisProperty.valueAtTime(jumpMarkerTime);
                
                linear(progress, 0, 1, startRot, targetRot) + (progress * giroFinal);
            } else {
                targetRot + giroFinal;
            }
        }
    }
} catch (err) {
    value;
}
`

export const expStockPos = `
try {
    const stockTag = "[STOCK]";
    const targetTag = "[TARGET]";
    const flipStockComment = "Flip Stock";
    const jumpComment = "Jump";
    const zStep = 0.05;
    const jumpHeight = 29;
    const midFrames = 6;
    const endFrames = 11;
    const shiftDelayBaseFrames = 2;
    const shiftDurationFrames = 11;
    const sampleTimeOffset = thisComp.frameDuration / 2;

    const hasTag = function(layer, tag) {
        return layer.name.indexOf(tag) !== -1;
    };

    const findMarkerTime = function(layer, comment) {
        if (layer.marker.numKeys < 1) return null;

        for (let i = 1; i <= layer.marker.numKeys; i++) {
            const marker = layer.marker.key(i);
            if (marker.comment === comment) return marker.time;
        }

        return null;
    };

    const findTargetLayer = function() {
        for (let i = 1; i <= thisComp.numLayers; i++) {
            const layer = thisComp.layer(i);
            if (hasTag(layer, targetTag)) return layer;
        }

        return null;
    };

    const findNextStockLayer = function(baseLayer) {
        for (let i = baseLayer.index + 1; i <= thisComp.numLayers; i++) {
            const layer = thisComp.layer(i);
            if (hasTag(layer, stockTag)) return layer;
        }

        return null;
    };

    const getStockOrderBelow = function(baseLayer, targetLayer) {
        let order = 0;
        for (let i = baseLayer.index + 1; i <= targetLayer.index; i++) {
            const layer = thisComp.layer(i);
            if (hasTag(layer, stockTag)) order++;
        }

        return order;
    };

    const getShiftProgress = function(eventTime, currentTime, order) {
        const startTime = eventTime + framesToTime(shiftDelayBaseFrames + order);
        const endTime = startTime + framesToTime(shiftDurationFrames);

        if (currentTime < startTime) return 0;
        if (currentTime >= endTime) return 1;

        return ease(currentTime, startTime, endTime, 0, 1);
    };

    const getEventDistance = function(eventLayer, eventTime) {
        const nextStockLayer = findNextStockLayer(eventLayer);
        if (nextStockLayer === null) return 0;

        const sampleTime = Math.max(0, eventTime - sampleTimeOffset);
        const eventPos = eventLayer.transform.position.valueAtTime(sampleTime);
        const nextPos = nextStockLayer.transform.position.valueAtTime(sampleTime);

        return eventPos[0] - nextPos[0];
    };

    const getShiftOffsetAt = function(currentTime) {
        let offsetX = 0;

        for (let i = 1; i < thisLayer.index; i++) {
            const layer = thisComp.layer(i);
            if (!hasTag(layer, stockTag)) continue;

            const eventTime = findMarkerTime(layer, flipStockComment);
            if (eventTime === null || eventTime > currentTime) continue;

            const order = getStockOrderBelow(layer, thisLayer);
            if (order < 1) continue;

            const distance = getEventDistance(layer, eventTime);
            offsetX += distance * getShiftProgress(eventTime, currentTime, order);
        }

        return offsetX;
    };

    const getActionOrderAt = function(actionTime) {
        let order = 0;
        const tolerance = thisComp.frameDuration / 10;

        for (let i = 1; i <= thisComp.numLayers; i++) {
            const layer = thisComp.layer(i);
            if (layer.marker.numKeys < 1) continue;

            for (let j = 1; j <= layer.marker.numKeys; j++) {
                const marker = layer.marker.key(j);
                const isTargetAction = marker.comment === jumpComment || marker.comment === flipStockComment;
                if (!isTargetAction) continue;

                const isEarlier = marker.time < actionTime;
                const isSameTimeBeforeLayer = Math.abs(marker.time - actionTime) <= tolerance && layer.index <= thisLayer.index;
                if (isEarlier || isSameTimeBeforeLayer) order++;
            }
        }

        return Math.max(order, 1);
    };

    const flipTime = findMarkerTime(thisLayer, flipStockComment);
    const baseZ = value.length > 2 ? value[2] : 0;

    if (flipTime === null || time < flipTime) {
        [value[0] + getShiftOffsetAt(time), value[1], baseZ];
    } else {
        const targetLayer = findTargetLayer();
        const shiftAtFlip = getShiftOffsetAt(flipTime);
        const startPos = [value[0] + shiftAtFlip, value[1], baseZ];
        const targetPos = targetLayer === null
            ? startPos
            : targetLayer.transform.position.valueAtTime(flipTime);

        const targetX = targetPos[0];
        const targetZ = targetPos.length > 2 ? targetPos[2] : baseZ;
        const finalZ = targetZ - (getActionOrderAt(flipTime) * zStep);
        const diffX = Math.abs(targetX - startPos[0]);

        const midTime = flipTime + framesToTime(midFrames);
        const endTime = flipTime + framesToTime(endFrames);
        const midPos = [startPos[0] + (diffX / 2), startPos[1] - jumpHeight, finalZ];
        const endPos = [targetX, startPos[1], finalZ];

        if (time < midTime) {
            ease(time, flipTime, midTime, startPos, midPos);
        } else if (time < endTime) {
            ease(time, midTime, endTime, midPos, endPos);
        } else {
            endPos;
        }
    }
} catch (err) {
    value;
}
`

export const expStockFlip = `
try {
    const flipStockComment = "Flip Stock";
    let flipTime = null;

    if (thisLayer.marker.numKeys > 0) {
        for (let i = 1; i <= thisLayer.marker.numKeys; i++) {
            const marker = thisLayer.marker.key(i);
            if (marker.comment === flipStockComment) {
                flipTime = marker.time;
                break;
            }
        }
    }

    if (flipTime === null || value === 100) {
        value;
    } else {
        const firstKeyTime = flipTime + framesToTime(2);
        const secondKeyTime = flipTime + framesToTime(17);

        if (time < firstKeyTime) {
            value;
        } else if (time < secondKeyTime) {
            linear(time, firstKeyTime, secondKeyTime, 0, 100);
        } else {
            100;
        }
    }
} catch (err) {
    value;
}
`

export const expProgressBar = `
const findTriggerMoments = (comp, rules) => {
    const moments = [];
    for (let i = 1; i <= comp.numLayers; i++) {
        const layer = comp.layer(i);
        const rule = rules.find(r => layer.name.includes(r.nameTag));
        if (rule && layer.marker.numKeys > 0) {
            for (let j = 1; j <= layer.marker.numKeys; j++) {
                const m = layer.marker.key(j);
                if (m.comment === rule.markerTag) moments.push(m.time);
            }
        }
    }
    return moments.sort((a, b) => a - b);
};

const readCurveProgress = (curve, timeSinceStart) => {
    if (curve.numKeys < 2) return 1;
    const kStart = curve.key(1);
    const kEnd = curve.key(curve.numKeys);
    const duration = kEnd.time - kStart.time;
    const mappedTime = kStart.time + clamp(timeSinceStart, 0, duration);
    return (curve.valueAtTime(mappedTime) - kStart.value) / ((kEnd.value - kStart.value) || 0.001);
};

const generateStepMotion = (comp, currentTime, triggers, increment, curve, framesDelay, startVal, endVal) => {
    const delay = framesDelay * comp.frameDuration;
    let passedIndex = -1;
    for (let i = 0; i < triggers.length; i++) {
        if ((triggers[i] + delay) <= currentTime) passedIndex = i;
        else break;
    }
    if (passedIndex === -1) return startVal;
    const progress = readCurveProgress(curve, currentTime - (triggers[passedIndex] + delay));
    return Math.min(startVal + (passedIndex * increment) + (increment * progress), endVal);
};

const refLayer = effect("Comp Ref")("Layer");
let targetComp = thisComp;

if (refLayer != undefined) {
    try {
        if (refLayer.source.numLayers === undefined) throw 0;
        targetComp = refLayer.source;
    } catch (e) {
        // EASTER EGGS
        const quotes = [
            "In Precomps We Trust.",
            "It’s what’s inside that counts.",
            "This layer have no secrets.",
            "One layer is the loneliest number.",
            "Layers within layers. That is the way.",
            "Judge a comp by its contents.",
            "Knock, knock. No layers inside.",
            "Silence is golden, but markers are data.",
            "Don't bring a flat or Footage layer to a Comp fight.",
            "No secrets found here."
        ];
        
        const randomIndex = Math.floor(Math.abs(time * 10)) % quotes.length;
        
        throw \`
[Cards Gameplay Alert]
- \${quotes[randomIndex]}
- Please, select a valid Precomp containing Cards and Markers.\`;
    }
}

const searchRules = [{ nameTag: "[TABLEAU]", markerTag: "Jump" }];
const delayInFrames = 5;

const barProgressValue = effect("Animation Progress")("Slider");
const startPercent = effect("Start Percent")("Slider").value;
const endPercent = effect("End Percent")("Slider").value;

const times = findTriggerMoments(targetComp, searchRules);
const stepSize = times.length > 0 ? (endPercent - startPercent) / times.length : 0;

generateStepMotion(targetComp, time, times, stepSize, barProgressValue, delayInFrames, startPercent, endPercent);

`
