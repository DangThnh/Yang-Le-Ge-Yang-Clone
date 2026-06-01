const config = {
    type: Phaser.AUTO,
    width: 540,
    height: 960,
    backgroundColor: '#eef5db', // Màu nền xanh rêu nhạt theo GDD
    parent: 'game-container',
    scene: [BootScene, GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};
const game = new Phaser.Game(config);