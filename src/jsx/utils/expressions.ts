export const expPos = `
const control = effect("Cards Gameplay SuperPlay");
const jumpHeight = control("Jump Height").value;
// --- CONFIGURAÇÕES GERAIS ---
const jumpCurveShape = control("Jump Curve Shape").value;

// --- CONFIGURAÇÃO DO QUIQUE FINAL (LANDING / OVERSHOOT) ---
const bounceAmplitude = control("Bounce Amplitude").value;
const bounceFrequency = control("Bounce Frequency").value;
const bounceDecay = control("Bounce Decay").value;

// --- LABEL ALVO (cor do keyframe) ---
const targetLabel = 9; // 1–16 (igual aos labels do AE)
const baseValue = value;

// --- COLETA APENAS KEYS COM ESSE LABEL ---
let labeledKeys = [];
for (let i = 1; i <= numKeys; i++) {
    if (key(i).label == targetLabel) {
        labeledKeys.push(key(i));
    }
}

if (labeledKeys.length < 2) {
    baseValue;
} else {
    const firstKey = labeledKeys[0];
    const secondKey = labeledKeys[1];
    const firstKeyTime = firstKey.time;
    const secondKeyTime = secondKey.time;

    // FASE 2: O VOO (arco somado ao valor base)
    if (time >= firstKeyTime && time <= secondKeyTime) {
        const normalizedTime = (time - firstKeyTime) / (secondKeyTime - firstKeyTime);
        const baseArc = Math.sin(normalizedTime * Math.PI);
        const adjustedArc = Math.pow(baseArc, jumpCurveShape) * jumpHeight;
        [baseValue[0], baseValue[1] - adjustedArc, baseValue[2]];

    // FASE 3: ATERRISSAGEM (quique por cima da animação normal)
    } else if (time > secondKeyTime) {
        const landingTime = time - secondKeyTime;
        const bounce =
            Math.sin(landingTime * bounceFrequency * Math.PI * 2) *
            bounceAmplitude *
            Math.exp(-landingTime * bounceDecay);
        [baseValue[0], baseValue[1] + bounce, baseValue[2]];

    } else {
        baseValue;
    }
}
`

export const expRot = `
const firstKeyPosX = thisLayer.position.key(1)[0];
const compCenterX = thisComp.width / 2;
const isOnLeftSide = firstKeyPosX < compCenterX;

const rotationCtrl = effect("Cards Gameplay SuperPlay")("Rotation Cycles").value;
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
