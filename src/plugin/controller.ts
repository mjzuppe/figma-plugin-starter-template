import {
  readElementOne,
  readRoot,
  readRootLibraryOne,
  readRootModel,
  readSelectionData,
  readSelectionName,
  readUser,
} from '../app/functions/read';
import { initSelection, writeRootModel, writeSelection } from '../app/functions/write';
import { readSelection, readSelectionId } from '../app/functions/read';

import { getNodeById } from '../app/functions/ui';


const reloadRoot = async (data: { model: string }) => {
  const r = await readRootModel(figma, data.model);
  let payload = {};
  payload[data.model] = r;
  return await figma.ui.postMessage({ state: { model: payload } });
};

figma.showUI(__html__);
figma.ui.resize(500, 500); // set the size of the plugin UI height: 400, width: 3
figma.on('documentchange', async (event: any) => {
  const { documentChanges } = event;
  if (!documentChanges) return;
  const removed = documentChanges.filter((e: any) => e.type === 'DELETE');
  const created = documentChanges.filter((e: any) => e.type === 'CREATE');
  let library = await readRootModel(figma, 'library');
  if (removed) {
    for (const component of removed) {
      if (library[component.id] !== undefined) {
        await writeRootModel(figma, 'library', component.id, { ...library[component.id], active: false });
      }
    }
    await reloadRoot({ model: 'library' });
  } else if (created) {
    for (const component of created) {
      if (library[component.id] !== undefined) {
        await writeRootModel(figma, 'library', component.id, { ...library[component.id], active: true });
      }
    }
    await reloadRoot({ model: 'library' });
  }
});

figma.on('selectionchange', () => {
  if (!figma.currentPage.selection.length) figma.ui.postMessage({ selection: null });
});

figma.on('selectionchange', async () => {
  if (figma.currentPage.selection.length === 1) {
    const r = await readSelection(figma);
    // TODO if selection data not equal to library, then resync before proceeding
    await figma.ui.postMessage({ selection: r });
  } else figma.ui.postMessage({ selection: undefined });
});

figma.ui.onmessage = async ({ func, data }) => {
  switch (func) {
    case 'init':
      if (data.model === 'selection') {
        const root = readRoot(figma);
        const r_pre = await readSelection(figma);
        const selectionData = await readSelectionData(figma);
        const { id, name, type, parent } = selectionData;
        await initSelection(figma, id, name, type, parent, root);
        figma.ui.postMessage({ selection: r_pre });
        await reloadRoot({ model: 'library' });
        const r_post = await readSelection(figma);
        await figma.ui.postMessage({ selection: r_post });
      } else {
        const u: any = await readUser(figma);
        const r: any = await readRoot(figma);
        let payload: any = r;
        // Get user record
        let registeredUser: any = null;
        try {
          registeredUser = await fetch(`${process.env.API_URI}/functions/v1/api/auth`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            },
            method: 'POST',
            body: JSON.stringify({ id_figma: u.id }),
          });
          registeredUser = await registeredUser.json();
        } catch (e) {
          console.log('Error fetching user', e);
          registeredUser = { error: e };
        }
        if (!registeredUser.error) {
          const { id, id_figma, trial_end, status, license_key } = registeredUser;
          const userState = () => {
            const trial = new Date(trial_end);
            if (registeredUser.ls && registeredUser.ls.status === 'active') return 'pro';
            else if (registeredUser.ls && registeredUser.ls.status !== 'active') return 'pro-expired';
            else if (trial.valueOf() - Date.now() < 0) return 'trial-expired';
            else return 'trial';
          };

          // if (r.user && r.user[u.id] === undefined) { // TODO obsolete?

          payload.user = { ...r.user, [u.id]: { id, id_figma, trial_end, status: userState(), license_key } };
          // }
        }

        figma.ui.postMessage({ state: { root: payload } });
        figma.ui.postMessage({ user: payload.user[u.id] });
      }
      break;
    case 'read':
      if (!data.key) throw new Error('failure to select, key required');
      else getNodeById(figma, data.key);
      break;
    case 'write':
      if (data.model === 'selection') {
        const root = readRoot(figma);
        const selectionId = await readSelectionId(figma);
        const syncData = await readRootLibraryOne(figma, selectionId);
        await writeSelection(figma, data.key, data.value, { id: selectionId, root, ...syncData });
        const selectionMutated = await readSelection(figma);
        figma.ui.postMessage({ selection: selectionMutated });
        if (['label', 'tag'].includes(data.key)) {
          await reloadRoot({ model: 'library' });
        }
      } else {
        await writeRootModel(figma, data.model, data.key, data.value);
        await reloadRoot(data);
      }
      break;
    default:
      throw new Error(`Unknown command ${func}`);
      break;
  }

  // figma.closePlugin();
};
