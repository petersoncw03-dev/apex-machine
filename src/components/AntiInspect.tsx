'use client';

import { useEffect } from 'react';

export default function AntiInspect() {
  useEffect(() => {
    // 1. Bloquear Clique Direito
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 2. Bloquear Atalhos de Teclado
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
      }
      
      // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (DevTools)
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'i', 'j', 'c'].includes(e.key)) {
        e.preventDefault();
      }

      // Ctrl+U (Ver código-fonte)
      if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
      }
      
      // Ctrl+S (Salvar página)
      if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
      }

      // Ctrl+P (Imprimir página)
      if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
      }
    };

    // Registra os eventos
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    // 3. Bloqueador via Debugger (Armadilha Agressiva)
    // Isso vai travar a página a cada 1 segundo se o DevTools estiver aberto.
    const blockInspect = setInterval(() => {
      (function() {
        try {
          debugger; 
        } catch (e) {}
      })();
    }, 1000);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      clearInterval(blockInspect);
    };
  }, []);

  return null;
}
