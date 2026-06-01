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
        this.load.image('cow', 'cow.png');
        this.load.image('tractor', 'tractor.png');
        this.load.image('wheat', 'wheat.png');
        this.load.image('barn', 'barn.png');
        this.load.image('chicken', 'chicken.png');

         // DÙNG LẠI TÀI NGUYÊN JUMP JUMP
        this.load.image('dust', 'dust.png'); 
        

        this.load.setPath('assets/audio/');
        this.load.audio('sfx_land', 'land.mp3');         // Tiếng bốc bài xuống khay
        this.load.audio('sfx_perfect', 'perfect.mp3');   // Tiếng nổ bài Match-3
        this.load.audio('sfx_gameover', 'gameover.mp3'); // Tiếng thua

        this.load.setPath(''); 
        this.load.json('levelData', 'assets/levels/level_data.json');
    }

    create() {
        this.scene.start('GameScene');
    }
}