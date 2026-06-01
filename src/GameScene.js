class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    // NHẬN BIẾN LEVEL TỪ LẦN GỌI SCENE (Mặc định là màn 1 nếu không truyền vào)
    init(data) {
        this.currentLevelIndex = data.levelIndex || 1; 
    }

    create() {
        this.cameras.main.setBackgroundColor('#eef5db'); 

        this.TILE_WIDTH = 60;
        this.TILE_HEIGHT = 60;
        this.MAX_SLOTS = 7;

        this.activeTiles = []; 
        this.slotBar = [];     
        this.waitArea = []; 
        this.isAnimating = false; 

        // Lấy dữ liệu Level hiện tại từ file JSON đã tải ở BootScene
        let allLevelsData = this.cache.json.get('levelData').levels;
        
        // Cố gắng tìm màn chơi có ID tương ứng, nếu không thấy thì báo lỗi và quay về màn 1
        this.levelConfig = allLevelsData.find(l => l.id === this.currentLevelIndex);
        if (!this.levelConfig) {
            console.log("Đã hết màn chơi! Bắt đầu lại từ màn 1.");
            this.currentLevelIndex = 1;
            this.levelConfig = allLevelsData.find(l => l.id === 1);
        }

        // --- HIỂN THỊ TÊN MÀN CHƠI LÊN MÀN HÌNH ---
        this.add.text(270, 30, `Level ${this.levelConfig.id}: ${this.levelConfig.name}`, { 
            fontSize: '24px', 
            fill: '#555',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(200);

        this.add.rectangle(270, 850, 480, 80, 0x000000, 0.1).setStrokeStyle(4, 0x8b5a2b);

        if (this.textures.exists('dust')) {
            this.matchEmitter = this.add.particles(0, 0, 'dust', {
                speed: { min: 100, max: 300 }, angle: { min: 0, max: 360 },
                scale: { start: 1, end: 0 }, alpha: { start: 0.8, end: 0 },
                lifespan: 400, gravityY: 200, emitting: false 
            }).setDepth(200);
        }

        if (this.cache.audio.exists('sfx_land')) {
            this.landSound = this.sound.add('sfx_land');
        }

        this.createBoostersUI();

        // 1. CHUẨN BỊ MẢNG LAYOUT RỖNG TỪ JSON
        this.mapLayout = []; 
        
        // Deep copy dữ liệu JSON ra (để thuật toán sinh không làm hỏng data gốc)
        this.levelConfig.layout.forEach(p => {
            this.mapLayout.push({ x: p.x, y: p.y, z: p.z, icon: null });
        });

        // NẾU TỔNG SỐ LƯỢNG Ô KHÔNG CHIA HẾT CHO 3 THÌ SAO? 
        // Ta phải tự động nhét thêm "ô rác" lấp vào cho đủ chia hết cho 3 để tránh lỗi crash thuật toán!
        let remainder = this.mapLayout.length % 3;
        if (remainder !== 0) {
            let needed = 3 - remainder;
            
            // Tìm tọa độ của lá bài nằm ngoài cùng bên TRÁI và PHẢI của bản đồ
            let leftMost = this.mapLayout.reduce((prev, curr) => (curr.x < prev.x ? curr : prev));
            let rightMost = this.mapLayout.reduce((prev, curr) => (curr.x > prev.x ? curr : prev));

            if (needed === 1) {
                // Nếu thiếu 1 lá, lót nó xuống Tầng -1 của cọc ngoài cùng bên Trái
                this.mapLayout.push({ x: leftMost.x, y: leftMost.y, z: -1, icon: null });
            } else if (needed === 2) {
                // Nếu thiếu 2 lá, lót đối xứng 1 lá bên Trái, 1 lá bên Phải ở Tầng -1
                this.mapLayout.push({ x: leftMost.x, y: leftMost.y, z: -1, icon: null });
                this.mapLayout.push({ x: rightMost.x, y: rightMost.y, z: -1, icon: null });
            }
        }

        // =================================================================
        // NÂNG CẤP 2: TỰ ĐỘNG NHẬN DIỆN "CỌC BÀI MÙ" VÀ TẠO HIỆU ỨNG THỊ GIÁC XẾP CHỒNG
        // =================================================================
        // Gom nhóm các ô bài có chung tọa độ X, Y
        let coordinateGroups = {};
        this.mapLayout.forEach(p => {
            let key = `${p.x}_${p.y}`;
            if (!coordinateGroups[key]) coordinateGroups[key] = [];
            coordinateGroups[key].push(p);
        });

        // Quét các nhóm, nhóm nào có TỪ 2 LÁ TRỞ LÊN -> Đó chính là Cọc Bài Mù!
        for (let key in coordinateGroups) {
            let pile = coordinateGroups[key];
            if (pile.length > 1) {
                // Sắp xếp các lá trong cọc từ tầng thấp (z nhỏ) lên tầng cao (z lớn)
                pile.sort((a, b) => a.z - b.z); 
                
                // Trượt tọa độ Y của các lá tầng trên xuống dưới 5px để lộ viền lá bên dưới
                pile.forEach((p, index) => {
                    p.y += (index * 5); 
                });
            }
        }

        // 2. CHẠY THUẬT TOÁN SINH NGƯỢC (100% GIẢI ĐƯỢC)
        this.generateSolvableMap();
        
        // 3. CẬP NHẬT TRẠNG THÁI KHÓA/MỞ
        this.updateTileStates();
    }

    // (XÓA HÀM createLayoutStructure CŨ ĐI VÌ CHÚNG TA ĐÃ DÙNG JSON RỒI)

    generateSolvableMap() {
        const iconTypes = [
            'apple', 'banana', 'carrot', 'grape', 'watermelon',
            'cow', 'tractor', 'wheat', 'barn', 'chicken'
        ];

        let emptyPoints = [...this.mapLayout];

        while (emptyPoints.length >= 3) {
            let randomIcon = iconTypes[Math.floor(Math.random() * iconTypes.length)];

            for (let i = 0; i < 3; i++) {
                let randomIndex = Math.floor(Math.random() * emptyPoints.length);
                let point = emptyPoints.splice(randomIndex, 1)[0];
                point.icon = randomIcon;
            }
        }

        this.renderGeneratedMap();
    }

    // ... (Phần renderGeneratedMap và các hàm phía dưới GIỮ NGUYÊN HOÀN TOÀN) ...

    // =======================================================
    // C. RENDER BẢN ĐỒ TỪ DỮ LIỆU ĐÃ SINH
    // =======================================================
    renderGeneratedMap() {
        this.mapLayout.forEach(point => {
            // Đề phòng trường hợp tổng số điểm khai báo ở Layout không chia hết cho 3
            if (!point.icon) return; 

            let tileSprite = this.add.sprite(point.x, point.y, point.icon);
            
            tileSprite.tileData = {
                id: Phaser.Utils.String.UUID(),
                icon: point.icon,
                gridZ: point.z, 
                isLocked: false 
            };
            
            tileSprite.originalDepth = point.z;
            tileSprite.originalX = point.x;
            tileSprite.originalY = point.y;
            
            tileSprite.setDepth(point.z); 
            tileSprite.setInteractive({ useHandCursor: true });
            
            tileSprite.on('pointerdown', () => this.onTileHover(tileSprite));
            tileSprite.on('pointerout', () => this.onTileCancel(tileSprite));
            tileSprite.on('pointerup', () => this.onTileSelected(tileSprite));

            this.activeTiles.push(tileSprite);
        });
    }

    // Helper tạo giao diện Boosters
    createBoostersUI() {
        const createBtn = (x, text, callback) => {
            let btn = this.add.rectangle(x, 930, 100, 40, 0x4caf50).setInteractive({ useHandCursor: true });
            let label = this.add.text(x, 930, text, { fontSize: '18px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
            
            btn.on('pointerdown', () => {
                if (this.isAnimating) return;
                
                // Hiệu ứng bấm nút
                this.tweens.add({ targets: [btn, label], scale: 0.9, yoyo: true, duration: 50 });
                callback();
                
                // Dùng xong thì vô hiệu hóa nút (Mỗi loại chỉ dùng 1 lần)
                btn.setFillStyle(0x777777);
                btn.disableInteractive();
            });
        };

        createBtn(120, 'Đảo Bài', () => this.useShuffle());
        createBtn(270, 'Hoàn Tác', () => this.useUndo());
        createBtn(420, 'Bốc 3 Lá', () => this.useMoveOut());
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
    // =======================================================
    // 4. HỆ THỐNG TƯƠNG TÁC VÀ HIỆU ỨNG NHẤC BÀI
    // =======================================================

    // Khi NHẤN GIỮ chuột xuống (Hiệu ứng nhấc bài lên)
    onTileHover(tile) {
        if (tile.tileData.isLocked || this.isAnimating) return;

        // Phóng to lên 1.2 lần, dịch nhẹ lên trên và quăng nó lên lớp trên cùng để không bị thằng nào đè
        this.tweens.add({
            targets: tile,
            scaleX: 1.2,
            scaleY: 1.2,
            y: tile.originalY - 10, // Nổi lên 10 pixel
            duration: 100,
            ease: 'Quad.easeOut'
        });
        
        tile.setDepth(100); // Tạm thời đè lên vạn vật
    }

    // Khi KÉO CHUỘT RA NGOÀI lỡ cỡ (Hủy thao tác)
    onTileCancel(tile) {
        if (tile.tileData.isLocked || this.isAnimating) return;

        // Trả về kích thước và vị trí cũ
        this.tweens.add({
            targets: tile,
            scaleX: 1,
            scaleY: 1,
            y: tile.originalY,
            duration: 100,
            ease: 'Quad.easeIn'
        });
        
        tile.setDepth(tile.originalDepth); // Trả về lớp hiển thị gốc
    }

   // Khi NHẢ CHUỘT RA (Xác nhận bốc bài đưa xuống khay)
    onTileSelected(tile) {
        if (tile.tileData.isLocked || this.isAnimating) return;
        
        // Nếu khay đã chứa đủ 7 lá thì không cho bốc nữa
        if (this.slotBar.length >= this.MAX_SLOTS) {
            console.log("Khay đã đầy!");
            return;
        }

        // KHÓA TOÀN BỘ GAME (Chống Spam Click gây lỗi dữ liệu)
        this.isAnimating = true;

        // Phát tiếng "cạch" khi bốc bài
        if (this.cache.audio.exists('sfx_land')) {
            this.sound.play('sfx_land');
        }

        // 1. Loại bỏ khỏi bàn chơi
        this.activeTiles = this.activeTiles.filter(t => t.tileData.id !== tile.tileData.id);
        tile.disableInteractive();

        // 2. THUẬT TOÁN SẮP XẾP CHÈN NGANG (Cực kỳ quan trọng)
        // Tìm xem trong khay đã có cái lá nào giống icon của lá này chưa
    let insertIndex = this.slotBar.findIndex(t => t.tileData.icon === tile.tileData.icon);
        
        if (insertIndex === -1) {
            this.slotBar.push(tile);
        } else {
            let lastIndexOfSameType = insertIndex;
            for (let i = insertIndex + 1; i < this.slotBar.length; i++) {
                if (this.slotBar[i].tileData.icon === tile.tileData.icon) {
                    lastIndexOfSameType = i;
                } else {
                    break;
                }
            }
            this.slotBar.splice(lastIndexOfSameType + 1, 0, tile);
        }

        // --- SỬA Ở ĐÂY: Truyền cái icon của lá bài VỪA BỐC xuống cho khay ---
        this.rearrangeSlotBar(tile.tileData.icon);
    }

    // =======================================================
    // 5. CẬP NHẬT GIAO DIỆN KHAY CHỨA (TWEEN ANIMATION)
    // =======================================================
    rearrangeSlotBar(lastIcon = null) {
        let startX = 60; 
        let slotY = 850; 
        let stepX = 70; 

        let totalTweens = this.slotBar.length;
        let completedTweens = 0;

        if (totalTweens === 0) {
            this.isAnimating = false;
            this.checkEndGameConditions();
            return;
        }

        this.slotBar.forEach((tile, index) => {
            let targetX = startX + (index * stepX);
            tile.setDepth(100 + index); 

            this.tweens.add({
                targets: tile,
                x: targetX,
                y: slotY,
                scaleX: 1, 
                scaleY: 1,
                duration: 250, 
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    completedTweens++;
                    if (completedTweens === totalTweens) {
                        this.updateTileStates(); 
                        
                        // --- SỬA Ở ĐÂY: Dùng đúng cái lastIcon truyền từ hàm bốc bài ---
                        if (lastIcon) {
                            this.checkMatch3(lastIcon);
                        } else {
                            this.isAnimating = false;
                            this.checkEndGameConditions();
                        }
                    }
                }
            });
        });
    }

    // =======================================================
    // 6. LOGIC TRIỆT TIÊU MATCH-3 VÀ DỒN TOA
    // =======================================================
    checkMatch3(iconType) {
        if (!iconType) {
            this.isAnimating = false;
            this.checkEndGameConditions();
            return;
        }

        let matchedTiles = this.slotBar.filter(t => t.tileData.icon === iconType);

        if (matchedTiles.length === 3) {
            this.isAnimating = true;

            // Phát tiếng Ting ăn điểm
            if (this.cache.audio.exists('sfx_perfect')) {
                this.sound.play('sfx_perfect');
            }

            this.slotBar = this.slotBar.filter(t => !matchedTiles.includes(t));

            this.tweens.add({
                targets: matchedTiles,
                scaleX: 0, scaleY: 0, alpha: 0, angle: 180,
                duration: 250, ease: 'Back.easeIn',
                onComplete: () => {
                    // --- BẮN HẠT BỤI MÀU MÈ TẠI VỊ TRÍ 3 LÁ BÀI NỔ ---
                    if (this.matchEmitter) {
                        matchedTiles.forEach(t => {
                            this.matchEmitter.emitParticleAt(t.x, t.y, 8); // Bắn 8 hạt mỗi vị trí
                        });
                    }

                    matchedTiles.forEach(t => t.destroy());

                    if (this.slotBar.length > 0) {
                        this.rearrangeSlotBar(); 
                    } else {
                        this.isAnimating = false;
                        this.checkEndGameConditions();
                    }
                }
            });
        } else {
            this.isAnimating = false;
            this.checkEndGameConditions();
        }
    }

    // =======================================================
    // 7. QUYẾT ĐỊNH SỐ PHẬN (THẮNG / THUA)
    // =======================================================
    checkEndGameConditions() {
        // ĐIỀU KIỆN THẮNG: Không còn lá nào trên bàn VÀ khay cũng trống trơn
       if (this.activeTiles.length === 0 && this.slotBar.length === 0) {
            this.isAnimating = true; 
            if (this.cache.audio.exists('sfx_perfect')) this.sound.play('sfx_perfect'); 
            
            this.add.text(270, 480, `VICTORY!\nCHUYỂN SANG MÀN ${this.currentLevelIndex + 1}...`, { 
                fontSize: '36px', fill: '#ff5722', fontStyle: 'bold', align: 'center'
            }).setOrigin(0.5).setDepth(200);

            // Đợi 2 giây rồi Restart Scene kèm theo việc tăng Level lên 1
            this.time.delayedCall(2000, () => {
                this.scene.restart({ levelIndex: this.currentLevelIndex + 1 });
            });
        } 

        // ĐIỀU KIỆN THUA: Khay chứa nhét đầy 7 lá mà không có bộ 3 nào để triệt tiêu
        else if (this.slotBar.length >= this.MAX_SLOTS) {
            
            this.isAnimating = true; 
             if (this.cache.audio.exists('sfx_gameover')) this.sound.play('sfx_gameover'); // Tiếng Thua
            
            // Làm đen màn hình tạo cảm giác thua cuộc
            this.add.rectangle(270, 480, 540, 960, 0x000000, 0.7).setDepth(199);
            this.add.text(270, 480, 'GAME OVER!\nSLOTS ARE FULL!', { 
                fontSize: '40px', 
                fill: '#ff0000',
                fontStyle: 'bold',
                align: 'center'
            }).setOrigin(0.5).setDepth(200);

            // Đợi 2 giây rồi Restart
            this.time.delayedCall(2000, () => {
                this.scene.restart();
            });
        }
    }

    // =======================================================
    // 8. HỆ THỐNG BOOSTERS (TRỢ GIÚP)
    // =======================================================

    // BOOSTER 1: XÁO TRỘN BÀN CHƠI (SHUFFLE)
    useShuffle() {
        // Gom toàn bộ icon của các lá bài còn lại trên bàn
        let currentIcons = this.activeTiles.map(t => t.tileData.icon);
        
        // Đảo ngẫu nhiên mảng icon này
        Phaser.Utils.Array.Shuffle(currentIcons);
        
        // Gán lại icon mới cho từng lá bài trên bàn, giữ nguyên cấu trúc Z-index
        this.activeTiles.forEach((tile, index) => {
            let newIcon = currentIcons[index];
            tile.tileData.icon = newIcon;
            tile.setTexture(newIcon); // Thay đổi hình ảnh thực tế
        });

        // Chạy hiệu ứng nhấp nháy báo hiệu đã đảo
        this.tweens.add({ targets: this.activeTiles, alpha: 0.2, yoyo: true, duration: 150 });
    }

    // BOOSTER 2: HOÀN TÁC (UNDO)
    useUndo() {
        // Chỉ chạy nếu khay có bài
        if (this.slotBar.length === 0) return;

        this.isAnimating = true;

        // Lấy lá bài CUỐI CÙNG được bốc vào khay (nằm ở cuối mảng)
        let lastTile = this.slotBar.pop();

        // Đưa lại vào mảng bàn chơi
        this.activeTiles.push(lastTile);

        // Kích hoạt lại tương tác
        lastTile.setInteractive({ useHandCursor: true });
        
        // Cập nhật lại Z-index gốc
        lastTile.setDepth(lastTile.originalDepth);

        // Bắt nó bay từ Khay về lại Tọa độ gốc trên bàn
        this.tweens.add({
            targets: lastTile,
            x: lastTile.originalX, // (ĐẢM BẢO CẬU ĐÃ THÊM tileSprite.originalX = xPos; ở hàm renderMap)
            y: lastTile.originalY,
            scaleX: 1, scaleY: 1,
            duration: 300,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.updateTileStates(); // Cập nhật lại toàn bộ đè lớp
                if (this.slotBar.length > 0) {
                    this.rearrangeSlotBar(); // Dồn toa lại cái Khay bị mất 1 lá
                } else {
                    this.isAnimating = false;
                }
            }
        });
    }

    // BOOSTER 3: BỐC 3 LÁ (MOVE OUT)
   // BOOSTER 3: BỐC 3 LÁ (MOVE OUT)
    useMoveOut() {
        if (this.slotBar.length < 3) return;

        this.isAnimating = true;

        // Cắt 3 lá đầu tiên trong khay ra
        let removedTiles = this.slotBar.splice(0, 3);
        this.waitArea = this.waitArea.concat(removedTiles);

        removedTiles.forEach((tile, index) => {
            let waitX = 150 + (index * 70); // Tọa độ X trên đài chờ
            let waitY = 100;                // Tọa độ Y trên đài chờ

            tile.setInteractive({ useHandCursor: true });
            
            // Tẩy sạch toàn bộ sự kiện click cũ của Kim tự tháp
            tile.off('pointerdown');
            tile.off('pointerup');
            tile.off('pointerout');
            
            // --- HỆ THỐNG TƯƠNG TÁC ĐỘC LẬP CHO KHU VỰC CHỜ ---
            
            // 1. Nhấn giữ: Phóng to nhẹ lên Scale 1 và nảy lên
            tile.on('pointerdown', () => {
                if (this.isAnimating) return;
                this.tweens.add({ targets: tile, scaleX: 1, scaleY: 1, y: waitY - 10, duration: 100 });
                tile.setDepth(200);
            });
            
            // 2. Di chuột ra ngoài (Hủy bốc): Trả về Scale 0.8 và nằm im trên bệ chờ
            tile.on('pointerout', () => {
                if (this.isAnimating) return;
                this.tweens.add({ targets: tile, scaleX: 0.8, scaleY: 0.8, y: waitY, duration: 100 });
                tile.setDepth(150 + index); // Trả về depth khu chờ
            });
            
            // 3. Nhả chuột (Quyết định đưa lại xuống khay)
            tile.on('pointerup', () => {
                if (this.isAnimating) return;
                // Bỏ nó khỏi mảng chờ
                this.waitArea = this.waitArea.filter(t => t !== tile);
                // Phục hồi Scale gốc để bay xuống khay không bị nhỏ
                tile.scaleX = 1; 
                tile.scaleY = 1; 
                // Gọi hàm bốc bài nhét lại vào Khay
                this.onTileSelected(tile); 
            });

            // Tween bay từ Khay lên Khu vực chờ
            this.tweens.add({
                targets: tile,
                x: waitX, 
                y: waitY, 
                scaleX: 0.8, scaleY: 0.8, // Thu nhỏ lại cho gọn
                duration: 300,
                ease: 'Cubic.easeOut',
            });
        });

        // Dồn toa lại Khay sau khi cắt 3 lá
        this.time.delayedCall(300, () => {
            if (this.slotBar.length > 0) {
                this.rearrangeSlotBar(); 
            } else {
                this.isAnimating = false;
            }
        });
    }
}