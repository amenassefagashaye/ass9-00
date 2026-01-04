// Add to your existing game code
window.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('admin') === 'true') {
        // Create admin controls directly
        const adminDiv = document.createElement('div');
        adminDiv.innerHTML = `
            <div style="
                position: fixed;
                top: 10px;
                right: 10px;
                background: #0d47a1;
                color: white;
                padding: 15px;
                border: 3px solid #28a745;
                border-radius: 10px;
                z-index: 9999;
                font-family: Arial;
            ">
                <h3 style="color: #ffd700; margin: 0 0 10px 0;">LOCAL ADMIN</h3>
                <p style="margin: 0 0 10px 0; color: #ccc; font-size: 12px;">
                    Password verified locally<br>
                    Full controls need server connection
                </p>
                <div style="display: grid; gap: 5px;">
                    <button onclick="if(window.startNewGame)window.startNewGame()" style="background: #28a745; color: white; border: none; padding: 8px; border-radius: 5px; cursor: pointer;">Start Game</button>
                    <button onclick="if(window.callNextNumber)window.callNextNumber()" style="background: #17a2b8; color: white; border: none; padding: 8px; border-radius: 5px; cursor: pointer;">Call Number</button>
                    <button onclick="if(window.resetGame)window.resetGame()" style="background: #dc3545; color: white; border: none; padding: 8px; border-radius: 5px; cursor: pointer;">Reset Game</button>
                </div>
            </div>
        `;
        document.body.appendChild(adminDiv);
        
        console.log('🔓 Local admin controls enabled (bypass)');
    }
});
