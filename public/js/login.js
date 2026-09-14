document.addEventListener('DOMContentLoaded', () => {
    // Formularios
    const formCredenciales = document.getElementById('form-credenciales');
    const formRegistro = document.getElementById('form-registro');
    const formDeposito = document.getElementById('form-deposito');
    
    // Botones de navegación interna
    const btnMostrarRegistro = document.getElementById('btn-mostrar-registro');
    const btnVolverLogin = document.getElementById('btn-volver-login');

    if (formCredenciales && formDeposito && formRegistro) {
        
        // --- Navegación entre Login y Registro ---
        btnMostrarRegistro.addEventListener('click', () => {
            formCredenciales.classList.add('hidden');
            formRegistro.classList.remove('hidden');
        });

        btnVolverLogin.addEventListener('click', () => {
            formRegistro.classList.add('hidden');
            formCredenciales.classList.remove('hidden');
        });

        // --- Evento de Submit: Registro ---
        formRegistro.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nombre = document.getElementById('reg-nombre').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;

            try {
                const response = await fetch('/api/registro', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre, email, password })
                });

                if (response.ok) {
                    alert('Cuenta registrada exitosamente. Ya podés iniciar sesión.');
                    formRegistro.reset();
                    formRegistro.classList.add('hidden');
                    formCredenciales.classList.remove('hidden');
                } else {
                    const error = await response.json();
                    alert(`Error: ${error.message}`);
                }
            } catch (err) {
                console.error('Error en la petición:', err);
                alert('Hubo un problema al conectar con el servidor.');
            }
        });

        // --- Evento de Submit: Autenticación ---
        formCredenciales.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                if (response.ok) {
                    const data = await response.json();
                    
                    // Guardar el token en el almacenamiento local del navegador
                    localStorage.setItem('sgvi_token', data.token);

                    // Llenar el <select> con los depósitos que vinieron de la base de datos
                    const selectDeposito = document.getElementById('deposito');
                    selectDeposito.innerHTML = '<option value="" disabled selected>Seleccione un depósito...</option>';
                    
                    data.depositos.forEach(dep => {
                        const option = document.createElement('option');
                        option.value = dep.ID_Deposito;
                        option.textContent = dep.Nombre;
                        selectDeposito.appendChild(option);
                    });

                    // Ocultar credenciales y mostrar el selector de depósito
                    formCredenciales.classList.add('hidden');
                    formDeposito.classList.remove('hidden');
                } else {
                    const error = await response.json();
                    alert(`Error: ${error.message}`);
                }
            } catch (err) {
                console.error('Error en el login:', err);
                alert('Hubo un problema al conectar con el servidor.');
            }
        });
        // --- Evento de Submit: Selección de depósito y Redirección ---
        formDeposito.addEventListener('submit', (e) => {
            e.preventDefault();
            const selectDeposito = document.getElementById('deposito');
            const nombreDeposito = selectDeposito.options[selectDeposito.selectedIndex].text;
            localStorage.setItem('sgvi_deposito_nombre', nombreDeposito);
            window.location.href = '/main.html';
        });
    }
});