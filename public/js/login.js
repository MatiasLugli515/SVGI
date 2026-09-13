document.addEventListener('DOMContentLoaded', () => {
    const formCredenciales = document.getElementById('form-credenciales');
    const formDeposito = document.getElementById('form-deposito');

    if (formCredenciales && formDeposito) {
        // Paso 1: Autenticación
        formCredenciales.addEventListener('submit', (e) => {
            e.preventDefault();
            // Acá a futuro harás el fetch('/api/login')
            
            formCredenciales.classList.add('hidden');
            formDeposito.classList.remove('hidden');
        });

        // Paso 2: Selección de depósito y Redirección
        formDeposito.addEventListener('submit', (e) => {
            e.preventDefault();
            // Acá a futuro harás el fetch() para guardar el depósito en la sesión
            
            window.location.href = '/main.html';
        });
    }
});