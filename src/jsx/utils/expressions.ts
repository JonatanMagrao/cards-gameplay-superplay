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

        const targetLayer = control("Target Layer");
        const targetOffset = control("Target Offset").value;
        const targetOffsetAngle = control("Target Offset Angle").value;

        const behindTarget = control("Behind Target").value;
        const zOffset = behindTarget === 1 ? 0.02 : -0.02;

        const jumpTime = framesToTime(jumpDurationFrames);
        const endTime = jumpMarkerTime + jumpTime;

        const rad = degreesToRadians(targetOffsetAngle - 90);
        const offsetX = Math.cos(rad) * targetOffset;
        const offsetY = Math.sin(rad) * targetOffset;

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