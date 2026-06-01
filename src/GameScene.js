class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    create() {
        // Cấu hình các hằng số logic cốt lõi (Gắn chặt với kích thước ảnh 60x60)
        this.TILE_WIDTH = 60;
        this.TILE_HEIGHT = 60;
        this.MAX_SLOTS = 7;

        // Khởi tạo các mảng quản lý dữ liệu
        this.activeTiles = []; 
        this.slotBar = [];     
        this.isAnimating = false; 

        // Vẽ Khay chứa bài dưới màn hình
        this.add.rectangle(270, 850, 480, 80, 0x000000, 0.1).setStrokeStyle(4, 0x8b5a2b);

        // Chạy quy trình khởi tạo lõi
        this.generateMapData();
        this.renderMap();
        this.updateTileStates();
    }

    // =======================================================
    // 1. TẠO DATA POOL (BỘI SỐ CỦA 3)
    // =======================================================
    generateMapData() {
        const iconTypes = ['apple', 'banana', 'carrot', 'grape', 'watermelon'];
        // Kim tự tháp mẫu cần đúng 39 ô bài (Tổng số ô của kim tự tháp 3 tầng: 5x5 + 3x3 + 1x1 + 4 ô rải rác = 39)
        // 39 ô = 13 bộ ba. Ta set totalSets = 13.
        const totalSets = 18; 
        let rawPool = [];

        // Mỗi lần bốc 1 loại quả, nhét đủ 3 ô vào mảng
        for (let i = 0; i < totalSets; i++) {
            let randomIcon = iconTypes[Math.floor(Math.random() * iconTypes.length)];
            rawPool.push(randomIcon, randomIcon, randomIcon);
        }

        // Xáo trộn ngẫu nhiên mảng dữ liệu (Trộn bài)
        Phaser.Utils.Array.Shuffle(rawPool);
        this.tileDataPool = rawPool;
    }

  // =======================================================
    // 2. VẼ BÀN CHƠI KIẾN TRÚC KIM TỰ THÁP (ĐÃ FIX TỌA ĐỘ)
    // =======================================================
    renderMap() {
        let poolIndex = 0;
        
        const spawnTile = (xPos, yPos, zIndex) => {
            if (poolIndex >= this.tileDataPool.length) return;

            let tileIcon = this.tileDataPool[poolIndex++];
            let tileSprite = this.add.sprite(xPos, yPos, tileIcon);
            
            tileSprite.tileData = {
                id: Phaser.Utils.String.UUID(),
                icon: tileIcon,
                gridZ: zIndex, 
                isLocked: false // Ban đầu giả định chưa khóa
            };
            
            tileSprite.setDepth(zIndex); 
            tileSprite.setInteractive({ useHandCursor: true });
            tileSprite.on('pointerdown', () => this.onTileSelected(tileSprite));

            this.activeTiles.push(tileSprite);
        };

        // TẦNG 0: 5x5 = 25 ô
        let startX0 = 150;
        let startY0 = 300;
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                spawnTile(startX0 + (c * 60), startY0 + (r * 60), 0);
            }
        }

        // TẦNG 1: 4x4 = 16 ô
        let startX1 = startX0 + 30;
        let startY1 = startY0 + 30;
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                spawnTile(startX1 + (c * 60), startY1 + (r * 60), 1);
            }
        }

        // TẦNG 2: 3x3 = 9 ô
        let startX2 = startX1 + 30;
        let startY2 = startY1 + 30;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                spawnTile(startX2 + (c * 60), startY2 + (r * 60), 2);
            }
        }

        // RẢI 4 Ô ĐỐI XỨNG Ở TẦNG 0 ĐỂ BỔ SUNG ĐỦ 54 Ô (Trông sẽ giống như cái đế đài)
        spawnTile(150 - 60, 300 - 60, 0); // Góc trên trái
        spawnTile(150 + 240 + 60, 300 - 60, 0); // Góc trên phải
        spawnTile(150 - 60, 300 + 240 + 60, 0); // Góc dưới trái
        spawnTile(150 + 240 + 60, 300 + 240 + 60, 0); // Góc dưới phải
    }

    // =======================================================
    // 3. THUẬT TOÁN QUYẾT ĐỊNH KHÓA / MỞ BÀI (AABB COLLISION)
    // =======================================================
  updateTileStates() {
        for (let i = 0; i < this.activeTiles.length; i++) {
            let tileA = this.activeTiles[i];
            let wasLocked = tileA.tileData.isLocked; // Lưu lại trạng thái cũ trước khi quét
            let isLocked = false;

            for (let j = 0; j < this.activeTiles.length; j++) {
                let tileB = this.activeTiles[j];
                
                if (tileB.tileData.gridZ > tileA.tileData.gridZ) {
                    let distanceX = Math.abs(tileA.x - tileB.x);
                    let distanceY = Math.abs(tileA.y - tileB.y);
                    
                    if (distanceX < (this.TILE_WIDTH - 2) && distanceY < (this.TILE_HEIGHT - 2)) {
                        isLocked = true;
                        break;
                    }
                }
            }

            // Cập nhật trạng thái mới vào dữ liệu
            tileA.tileData.isLocked = isLocked;

            // KIỂM TRA SỰ THAY ĐỔI ĐỂ CHẠY HIỆU ỨNG (Tránh chạy lại tween liên tục vô ích)
            if (isLocked && !wasLocked) {
                // Đang mở -> Bị Khóa: Làm tối nhanh
                tileA.setTint(0x555555);
            } 
            else if (!isLocked && wasLocked) {
                // Đang Khóa -> Được Mở: Hiệu ứng sáng dần mượt mà
                
                // Mẹo: Vì Phaser không hỗ trợ Tween trực tiếp cho hàm clearTint(),
                // nên ta phải clear nó đi, gán alpha thấp rồi tween alpha cho sáng lên từ từ.
                tileA.clearTint();
                tileA.alpha = 0.3; // Mờ đi một chút
                
                this.tweens.add({
                    targets: tileA,
                    alpha: 1, // Sáng rực rỡ trở lại
                    duration: 300, // Kéo dài 0.3 giây
                    ease: 'Sine.easeOut'
                });
            }
            // (Nếu trạng thái không đổi, ô bài sinh ra ban đầu đã tự thiết lập độ xỉn nếu bị khóa)
            else if (isLocked && wasLocked === false && !this.gameHasStarted) {
               tileA.setTint(0x555555);
            }
        }
        this.gameHasStarted = true; // Biến phụ để xử lý tint lần đầu tiên
    }

    // =======================================================
    // 4. CLICK CHỌN BÀI (CHƯA LÀM KHAY CHỨA)
    // =======================================================
    onTileSelected(tile) {
        // Nếu ô bài đang bị khóa thì cấm bấm
        if (tile.tileData.isLocked) {
            console.log("Ô bài này đang bị đè, không thể chọn!");
            return;
        }

        // TẠM THỜI Ở GIAI ĐOẠN NÀY CHÚNG TA CHỈ CHO Ô BÀI BIẾN MẤT
        // ĐỂ TEST XEM CÁC Ô BÊN DƯỚI CÓ SÁNG LÊN ĐÚNG LOGIC KHÔNG
        
        // Loại bỏ ô bài vừa click khỏi mảng quản lý
        this.activeTiles = this.activeTiles.filter(t => t.tileData.id !== tile.tileData.id);
        
        // Hủy hình ảnh
        tile.destroy();

        // CHÌA KHÓA CỦA TRÒ CHƠI: Cập nhật lại toàn bộ bàn cờ sau mỗi nước đi
        this.updateTileStates();
    }
}