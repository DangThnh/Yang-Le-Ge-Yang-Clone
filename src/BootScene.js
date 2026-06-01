class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        let progressBar = this.add.graphics();
        let progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(170, 465, 200, 30); 

        this.load.on('progress', function (value) {
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(180, 475, 180 * value, 10);
        });

        this.load.on('complete', function () {
            progressBar.destroy();
            progressBox.destroy();
        });

        // Tải mảng hình ảnh ô bài
        this.load.setPath('assets/images/');
        this.load.image('apple', 'apple.png');
        this.load.image('banana', 'banana.png');
        this.load.image('carrot', 'carrot.png');
        this.load.image('grape', 'grape.png');
        this.load.image('watermelon', 'watermelon.png');
    }

    create() {
        this.scene.start('GameScene');
    }
}