export const expPos = `
const control = effect("Pseudo/cards_gameplay_superplay");
const jumpHeight = control("Jump Height").value;
const jumpCurveShape = control("Jump Curve Shape").value;
const bounceAmplitude = control("Bounce Amplitude").value;
const bounceFrequency = control("Bounce Frequency").value;
const bounceDecay = control("Bounce Decay").value;
const targetLayer = control("Target Layer");
const targetOffset = control("Target Offset").value;
const targetOffsetAngle = control("Target Offset Angle").value;

// Lendo o checkbox (1 = true/marcado, 0 = false/desmarcado)
const behindTarget = control("Behind Target").value;
const targetLabel = 9; 

// Se behindTarget for 1, zOffset é 0.01. Senão, é 0.
const zOffset = behindTarget == 1 ? 0.01 : 0;

let labeledKeys = [];
for (let i = 1; i <= numKeys; i++) {
    if (key(i).label == targetLabel) {
        labeledKeys.push(key(i));
    }
}

if (labeledKeys.length < 2) {
    value; 
} else {
    const firstKeyTime = labeledKeys[0].time;
    const secondKeyTime = labeledKeys[1].time;

    const rad = degreesToRadians(targetOffsetAngle - 90);
    const offsetX = Math.cos(rad) * targetOffset;
    const offsetY = Math.sin(rad) * targetOffset;

    if (time < firstKeyTime) {
        value; 
    } else if (time >= firstKeyTime && time <= secondKeyTime) {
        const normalizedTime = (time - firstKeyTime) / (secondKeyTime - firstKeyTime);
        const startPos = thisProperty.valueAtTime(firstKeyTime);
        const rawTargetPos = targetLayer.transform.position.valueAtTime(time);
        const targetPos = [rawTargetPos[0] + offsetX, rawTargetPos[1] + offsetY, rawTargetPos[2]];
        const currentBasePos = linear(normalizedTime, 0, 1, startPos, targetPos);
        const baseArc = Math.sin(normalizedTime * Math.PI);
        const adjustedArc = Math.pow(baseArc, jumpCurveShape) * jumpHeight;
        
        // Usamos targetPos[2] direto aqui para evitar sobreposição durante o voo
        [currentBasePos[0], currentBasePos[1] - adjustedArc, targetPos[2] + zOffset];
    } else {
        const landingTime = time - secondKeyTime;
        const rawTargetPos = targetLayer.transform.position.valueAtTime(time);
        const targetPos = [rawTargetPos[0] + offsetX, rawTargetPos[1] + offsetY, rawTargetPos[2]];
        const bounce = Math.sin(landingTime * bounceFrequency * Math.PI * 2) * bounceAmplitude * Math.exp(-landingTime * bounceDecay);
            
        [targetPos[0], targetPos[1] + bounce, targetPos[2] + zOffset];
    }
}
`

export const expRot = `
const firstKeyPosX = thisLayer.position.key(1)[0];
const compCenterX = thisComp.width / 2;
const isOnLeftSide = firstKeyPosX < compCenterX;

const rotationCtrl = effect("Pseudo/cards_gameplay_superplay")("Rotation Cycles").value;
const spinRotation = isOnLeftSide ? rotationCtrl : -rotationCtrl;

// --- CÓDIGO ---
if (numKeys >= 2) {
    const firstKey = key(1);
    const secondKey = key(2);
    const firstKeyTime = firstKey.time;
    const secondKeyTime = secondKey.time;

    const baseRotation = value;

    // FASE 2: VOO — adiciona o giro desejado em cima do value
    if (time >= firstKeyTime && time <= secondKeyTime) {
        const spinOffset = linear(time, firstKeyTime, secondKeyTime, 0, spinRotation);
        baseRotation + spinOffset;

    // FASE 3: pós-queda — mantém o giro total somado
    } else if (time > secondKeyTime) {
        baseRotation + spinRotation;

    } else {
        baseRotation;
    }
} else {
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