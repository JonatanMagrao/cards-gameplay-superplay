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
    app.activeViewer?.setActive();
  }
  return app.project.activeItem as CompItem;
};

// Project Item Helpers
export const getItemByName = (name: string): CompItem | null => {
  // todo adicionar na função uma busca por tipo. atualmente está buscando apenas CompItem
  // Percorre todos os itens na raiz do projeto
  for (var i = 1; i <= app.project.numItems; i++) {
    const item = app.project.item(i);

    // Verifica se o nome bate E se é uma Composição
    if (item.name === name && item instanceof CompItem) {
      return item;
    }
  }
  return null;
};

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


