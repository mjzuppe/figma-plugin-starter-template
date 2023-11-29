// from: https://github.com/nirsky/figma-plugin-react-template

import React, { useState } from 'react';
import { controller } from '../functions/utils';

import '../styles/theme.css';
import '../styles/base.css';
import '../styles/menu.module.css';

import { Container } from './Container';

function App() {
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [db, setDb] = useState<any>(undefined);
  const [selectionData, setSelectionData] = useState<any>(undefined);

  React.useEffect(() => {
    controller({ func: 'init', data: {} });
    window.onmessage = async (event) => {
      // Listen to data sent from the plugin controller
      if (!event.data?.pluginMessage) return;
      else if ('selection' in event.data.pluginMessage) {
        setSelectionData(event.data.pluginMessage.selection);
        setLastUpdated(Date.now()); // This is only passed to inspector to force re-render/reset conditions on selection change
      } else if (event.data?.pluginMessage && event.data.pluginMessage.state) {
        const { state } = event.data.pluginMessage;
        if (state.root) await setDb(() => state.root);
        else if (state.model) await setDb((prevState: any) => ({ ...prevState, ...state.model }));
      };
    };
  }, []);

  return (
    <div style={{width: "100%", height: "100%"}} className="figma-dark">
        <Container />
    </div>
  );
}

export default App;
