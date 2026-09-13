document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. NAVEGACIÓN LATERAL (Dashboard vs Historial)
    // ==========================================
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.view-section');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);

            if (!targetSection) {
                console.warn(`No se encontró la sección con ID: ${targetId}`);
                return;
            }

            // Desactivar botones y ocultar todas las vistas
            navBtns.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.add('hidden'));

            // Activar el botón presionado y mostrar la sección correspondiente
            btn.classList.add('active');
            targetSection.classList.remove('hidden');
        });
    });

    // ==========================================
    // 2. CONTROL DE MODALES (Popups)
    // ==========================================
    const openModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('hidden');
    };

    const closeModal = (modalElement) => {
        if (!modalElement) return;
        modalElement.classList.add('hidden');
        const form = modalElement.querySelector('form');
        if (form) form.reset();
    };

    // Botones que disparan modales (con chequeo para no romper si alguno no existe)
    const btnIngreso = document.getElementById('btn-open-ingreso');
    const btnRetiro = document.getElementById('btn-open-retiro');
    const btnExportar = document.getElementById('btn-open-exportar');

    if (btnIngreso) btnIngreso.addEventListener('click', () => openModal('modal-ingreso'));
    if (btnRetiro) btnRetiro.addEventListener('click', () => openModal('modal-retiro'));
    if (btnExportar) btnExportar.addEventListener('click', () => openModal('modal-exportar'));

    // Configuración para cerrar modales (cruz y fondo oscuro)
    document.querySelectorAll('.modal').forEach(modal => {
        const closeBtn = modal.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => closeModal(modal));
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });

        const form = modal.querySelector('form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                alert('Operación registrada (Simulación)');
                closeModal(modal);
            });
        }
    });

    // ==========================================
    // 3. CERRAR SESIÓN
    // ==========================================
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            window.location.href = '/';
        });
    }
});