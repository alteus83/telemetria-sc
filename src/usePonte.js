// Collegamento della pagina al ponte (WebSocket), con riconnessione automatica.
import { useEffect, useState } from "react";

export function usePonte() {
  const [dati, setDati] = useState(null);
  const [collegato, setCollegato] = useState(false);

  useEffect(() => {
    let socket;
    let timer;
    let chiuso = false;

    function apri() {
      const protocollo = location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocollo}//${location.host}/ws`);
      socket.onopen = () => setCollegato(true);
      socket.onmessage = (e) => {
        try {
          setDati(JSON.parse(e.data));
        } catch {
          /* messaggio non valido: lo ignoriamo */
        }
      };
      socket.onclose = () => {
        setCollegato(false);
        if (!chiuso) timer = setTimeout(apri, 2000);
      };
    }

    apri();
    return () => {
      chiuso = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, []);

  return { dati, collegato };
}
