

const writeRoot = (figma: any, key: string, value: string) => figma.root.setPluginData(key, value);
const writeSelection = async (
  figma: any,
  key: string,
  value: any,
  syncData?: { id: string; label: string; tag: string[]; type: string; location: string; root: any; link?: string }
) => {
  const node = figma.currentPage.selection[0];
  if (['label', 'tag', 'link'].includes(key)) {
    if (!syncData) throw new Error(`syncData to store in db required for this parameter ${key}`);
    let label = key === 'label' ? value : syncData.label;
    let tag = key === 'tag' ? value : syncData.tag;
    let link = key === 'link' ? value : syncData.link;
    if (key === 'label') {
      const invalidLabels = Object.values(syncData.root.library)
        .filter((item: any) => item.active)
        .map((item: any) => item.label);
      let index = 0;
      while (invalidLabels.includes(label)) {
        index += 1;
        label = `${value} (${index})`;
      }
      await node.setPluginData(key, JSON.stringify(label));
    } else {
      await node.setPluginData(key, JSON.stringify(value));
    }
    let table = JSON.parse(figma.root.getPluginData('library'));
    table[syncData.id] = {
      label,
      tag,
      link,
      type: syncData.type,
      location: syncData.location,
      active: true,
    };
    await writeRoot(figma, 'library', JSON.stringify(table));
  } else await node.setPluginData(key, JSON.stringify(value));
  return;
};

const validKey = (model: string, key: string): boolean =>
  ['tag', 'variable'].includes(model) ? key.length > 0 : key.includes(':');

const writeRootModel = async (figma: any, model: string, key: string, value: any) => {
  if (typeof value === 'string') throw new Error('value must be an object');
  if (!validKey(model, key)) throw new Error('invalid key');
  // await validateRootInput(model, value);
  let table = JSON.parse(figma.root.getPluginData(model));
  table[key] = value;
  await writeRoot(figma, model, JSON.stringify(table));
  return;
};

export { writeRoot, writeSelection, writeRootModel };
