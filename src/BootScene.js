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
        this.load.image('corn', 'corn.png');
        this.load.image('bell', 'bell.png');
        this.load.image('carrot', 'carrot.png');
        this.load.image('brush', 'brush.png');
        this.load.image('bucket', 'bucket.png');
        this.load.image('cabbage', 'cabbage.png');
        this.load.image('campfire', 'campfire.png');
        this.load.image('glove', 'glove.png');
        this.load.image('grass', 'grass.png');
        this.load.image('hay', 'hay.png');
        this.load.image('milk', 'milk.png');
        this.load.image('pitchfork', 'pitchfork.png');
        this.load.image('shear', 'shear.png');
        this.load.image('stump', 'stump.png');
        this.load.image('yarn', 'yarn.png');


         // DÙNG LẠI TÀI NGUYÊN JUMP JUMP
        this.load.image('dust', 'dust.png'); 

          this.load.image('bg_1', 'bg_1.png');
        this.load.image('bg_2', 'bg_2.png');
        this.load.image('bg_3', 'bg_3.png');

        this.load.image('slot_bar', 'slot_bar.png');
        

        this.load.setPath('assets/audio/');
        this.load.audio('bgm', 'bgm.mp3');
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