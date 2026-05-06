export const forEachLayer = (
  comp: CompItem,
  callback: (item: Layer, index: number) => void
) => {
  const len = comp.numLayers;
  for (let i = 1; i < len + 1; i++) {
    callback(comp.layers[i], i);
  }
};

export const forEachComp = (
  folder: FolderItem | Project,
  callback: (item: CompItem, index: number) => void
) => {
  const len = folder.numItems;
  let comps: CompItem[] = [];
  for (let i = 1; i < len + 1; i++) {
    const item = folder.items[i];
    if (item instanceof CompItem) {
      comps.push(item);
    }
  }
  for (let i = 0; i < comps.length; i++) {
    let comp = comps[i];
    callback(comp, i);
  }
};

export const compFromFootage = (item: FootageItem): CompItem => {
  return app.project.items.addComp(
    item.name,
    item.width,
    item.height,
    item.pixelAspect,
    item.duration,
    item.frameRate
  );
};

export const getProjectDir = () => {
  app.project.file;
  if (app.project.file !== null) {
    return app.project.file.parent;
  } else {
    return "";
  }
};

export const getActiveComp = () => {
  if (app.project.activeItem instanceof CompItem === false) {
    try {
      if (app.activeViewer) app.activeViewer.setActive();
    } catch (_) { }
  }
  return app.project.activeItem as CompItem;
};

export const requireActiveComp = (actionName?: string, showAlert = true): CompItem | null => {
  if (app.project.activeItem instanceof CompItem === false) {
    try {
      if (app.activeViewer) app.activeViewer.setActive();
    } catch (_) { }
  }

  if (app.project.activeItem instanceof CompItem) {
    return app.project.activeItem as CompItem;
  }

  if (showAlert) {
    const actionText = actionName ? ` for "${actionName}"` : "";
    alert(`No active composition found${actionText}.\nPlease open or select a composition and try again.`);
  }

  return null;
};

export type CompStateSnapshot = {
  time: number;
  selectedLayers: Layer[];
}

export const getSelectedLayersSnapshot = (comp: CompItem): Layer[] => {
  const selectedLayers: Layer[] = [];

  for (let i = 0; i < comp.selectedLayers.length; i++) {
    selectedLayers.push(comp.selectedLayers[i]);
  }

  return selectedLayers;
}

export const layerListContains = (layers: Layer[], targetLayer: Layer): boolean => {
  for (let i = 0; i < layers.length; i++) {
    if (layers[i] === targetLayer) return true;
  }

  return false;
}

export const restoreLayerSelection = (comp: CompItem, selectedLayers: Layer[]) => {
  for (let i = 1; i <= comp.numLayers; i++) {
    const layer = comp.layer(i);
    layer.selected = layerListContains(selectedLayers, layer);
  }
}

export const captureCompState = (comp: CompItem): CompStateSnapshot => {
  return {
    time: comp.time,
    selectedLayers: getSelectedLayersSnapshot(comp),
  }
}

export const restoreCompState = (comp: CompItem, snapshot: CompStateSnapshot) => {
  comp.time = snapshot.time;
  restoreLayerSelection(comp, snapshot.selectedLayers);
}

// Project Item Helpers
export const findProjectItemByName = (itemName: string, advice: boolean = true) : Item | null => {
  var project = app.project;
  for (var i = 1; i <= project.numItems; i++) {
    var projectItem = project.item(i);
    if (projectItem && projectItem.name === itemName) return projectItem;
  }
  if(advice){
    alert(`Project Item "${itemName}" not found`);
  }
  
  return null;
}

export const findCompItemByName = (itemName: string, advice: boolean = true): CompItem | null => {
  const item = findProjectItemByName(itemName, false);

  if (item && item instanceof CompItem) return item as CompItem;

  if (advice) alert(`Project comp "${itemName}" not found`);
  return null;
}

export const findFootageItemByName = (itemName: string, advice: boolean = true): FootageItem | null => {
  const item = findProjectItemByName(itemName, false);

  if (item && item instanceof FootageItem) return item as FootageItem;

  if (advice) alert(`Project footage "${itemName}" not found`);
  return null;
}

export const findAvItemByName = (itemName: string, advice: boolean = true): AVItem | null => {
  const item = findProjectItemByName(itemName, false);

  if (item && (item instanceof CompItem || item instanceof FootageItem)) return item as AVItem;

  if (advice) alert(`Project AV item "${itemName}" not found`);
  return null;
}

export const findFolderItemByName = (itemName: string, advice: boolean = true): FolderItem | null => {
  const item = findProjectItemByName(itemName, false);

  if (item && item instanceof FolderItem) return item as FolderItem;

  if (advice) alert(`Project folder "${itemName}" not found`);
  return null;
}

// Metadata helpers

export const setAeMetadata = (propName: string, propValue: any) => {
  if (ExternalObject.AdobeXMPScript === undefined) {
    ExternalObject.AdobeXMPScript = new ExternalObject("lib:AdobeXMPScript");
  }
  if (!app.project || !ExternalObject.AdobeXMPScript || !XMPMeta) return;
  const prefix = "xmp:";
  const uri = XMPMeta.getNamespaceURI(prefix);
  const newPropName = prefix + propName;
  let metadata = new XMPMeta(app.project.xmpPacket);
  metadata.setProperty(uri, newPropName, propValue.toString());
  app.project.xmpPacket = metadata.serialize();
};

export const getAeMetadata = (propName: string) => {
  if (ExternalObject.AdobeXMPScript === undefined) {
    ExternalObject.AdobeXMPScript = new ExternalObject("lib:AdobeXMPScript");
  }
  if (!app.project || !ExternalObject.AdobeXMPScript || !XMPMeta) return;
  const prefix = "xmp:";
  const uri = XMPMeta.getNamespaceURI(prefix);
  const newPropName = prefix + propName;
  const metadata = new XMPMeta(app.project.xmpPacket);
  return metadata.getProperty(uri, newPropName);
};


