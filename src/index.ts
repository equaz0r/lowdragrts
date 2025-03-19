import { Game } from './engine/Game';

// Create and start the game
const game = new Game();

// Handle cleanup on window close
window.addEventListener('beforeunload', () => {
    game.dispose();
});

export { Game };