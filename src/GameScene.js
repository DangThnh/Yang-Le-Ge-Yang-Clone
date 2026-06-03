class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    init(data) {
        // Tích lũy Level và Quản lý số lượt trợ giúp giữa các màn
        this.currentLevelIndex = data.levelIndex || 1; 
        
        // Quản lý số lượt Boosters: Mỗi loại có 1 lượt Free + 1 lượt Share
        this.boosters = data.boosters || {
            shuffle: { free: 1, share: 1 },
            undo: { free: 1, share: 1 },
            moveOut: { free: 1, share: 1 }
        };
        
        // Biến phục vụ hệ thống Share
        this.pendingShareBooster = null; 
    }

    create() {
        // 1. RENDER BACKGROUND RANDOM
        let randomBgNum = Phaser.Math.Between(1, 3);
        if (this.textures.exists(`bg_${randomBgNum}`)) {
            this.add.image(270, 480, `bg_${randomBgNum}`).setDisplaySize(540, 960).setDepth(-10);
        } else {
            this.cameras.main.setBackgroundColor('#eef5db'); 
        }

        // 2. PHÁT NHẠC NỀN (Loop vô hạn)
        if (this.cache.audio.exists('bgm')) {
            // Kiểm tra xem nhạc đã chạy chưa để tránh bị đè nhạc khi qua màn
            let bgm = this.sound.get('bgm');
            if (!bgm) {
                this.sound.play('bgm', { loop: true, volume: 0.5 });
            }
        }

        this.TILE_WIDTH = 60; this.TILE_HEIGHT = 60; this.MAX_SLOTS = 7;
        this.activeTiles = []; this.slotBar = []; this.waitArea = []; 
        this.isAnimating = false; 

        // TEXT LEVEL VÔ HẠN
        let levelTitle = this.currentLevelIndex === 1 ? "Level 1: Tutorial" : `Level ${this.currentLevelIndex}:`;
        this.add.text(270, 30, levelTitle, { fontSize: '24px', fill: '#ffffff', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(200);

        //this.add.rectangle(270, 850, 480, 80, 0x000000, 0.5).setStrokeStyle(4, 0x8b5a2b);
        
        // --- GIAO DIỆN KHAY CHỨA MỚI (DÙNG ASSET ẢNH) ---
        // Đặt ảnh khay chứa vào đúng tọa độ cũ: X=270 (Giữa màn hình), Y=850
        this.slotBarImage = this.add.image(270, 880, 'slot_bar').setDepth(0);

        // ĐIỀU CHỈNH KÍCH THƯỚC ĐỂ KHỚP VỚI KHUNG CŨ:
        // Khung cũ của chúng ta có kích thước là Rộng (Width) = 480px, Cao (Height) = 80px.
        // Dùng lệnh setDisplaySize để ép bức ảnh của cậu phình ra hoặc teo lại đúng bằng kích thước này,
        // bất chấp ảnh gốc của cậu to nhỏ ra sao.
        this.slotBarImage.setDisplaySize(580, 250);

        // TẠO UI BOOSTERS VÀ POPUP SHARE

          if (this.cache.audio.exists('sfx_land')) {
            this.landSound = this.sound.add('sfx_land');
        }
        if (this.cache.audio.exists('sfx_perfect')) {
            this.perfectSound = this.sound.add('sfx_perfect');
        }
        if (this.cache.audio.exists('sfx_gameover')) {
            this.gameoverSound = this.sound.add('sfx_gameover');
        }

        this.createBoostersUI();
        this.createSharePopup();

        // 3. TẠO MÀN CHƠI
        this.mapLayout = []; 
        if (this.currentLevelIndex === 1) {
            // MÀN 1: Từ JSON (Tutorial)
            let allLevelsData = this.cache.json.get('levelData').levels;
            let lvl1Data = allLevelsData.find(l => l.id === 1);
            lvl1Data.layout.forEach(p => this.mapLayout.push({ x: p.x, y: p.y, z: p.z, icon: null }));
        } else {
            // TỪ MÀN 2 TRỞ ĐI: VÔ HẠN MAP ĐỊA NGỤC (Generative)
            this.generateHellModeLayout();
        }

        let remainder = this.mapLayout.length % 3;
        if (remainder !== 0) {
            let needed = 3 - remainder;
            let leftMost = this.mapLayout.reduce((prev, curr) => (curr.x < prev.x ? curr : prev));
            let rightMost = this.mapLayout.reduce((prev, curr) => (curr.x > prev.x ? curr : prev));
            if (needed === 1) this.mapLayout.push({ x: leftMost.x, y: leftMost.y, z: -1, icon: null });
            else if (needed === 2) {
                this.mapLayout.push({ x: leftMost.x, y: leftMost.y, z: -1, icon: null });
                this.mapLayout.push({ x: rightMost.x, y: rightMost.y, z: -1, icon: null });
            }
        }

        // 4. CHẠY THUẬT TOÁN SINH BÀI
        this.generateSolvableMap();
        this.updateTileStates();

        // ĐĂNG KÝ SỰ KIỆN RỜI TAB CHO HỆ THỐNG SHARE
        this.registerVisibilityEvent();
    }

    // =======================================================
    // HỆ THỐNG SHARE LINK VIRAL
    // =======================================================
    // createSharePopup() {
    //     // Khung Popup ẩn
    //     this.sharePopup = this.add.container(0, 0).setDepth(300).setVisible(false);
        
    //     // Màn đen mờ
    //     let bg = this.add.rectangle(270, 480, 540, 960, 0x000000, 0.8).setInteractive(); 
        
    //     // Bảng thông báo
    //     let panel = this.add.rectangle(270, 480, 400, 250, 0xffffff, 1).setStrokeStyle(4, 0x000000);
    //     let title = this.add.text(270, 400, 'HẾT LƯỢT MIỄN PHÍ!', { fontSize: '24px', fill: '#ff0000', fontStyle: 'bold' }).setOrigin(0.5);
    //     let desc = this.add.text(270, 450, 'Hãy Copy link game và chia sẻ\ncho bạn bè để nhận 1 lượt\ntrợ giúp ngay lập tức!', { fontSize: '18px', fill: '#333', align: 'center' }).setOrigin(0.5);
        
    //     // Nút Copy
    //     let btnCopy = this.add.rectangle(270, 520, 200, 50, 0x4caf50).setInteractive({ useHandCursor: true });
    //     let textCopy = this.add.text(270, 520, 'COPY LINK & SHARE', { fontSize: '18px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
        
    //     // Nút Hủy
    //     let btnClose = this.add.text(270, 570, 'Bỏ qua', { fontSize: '16px', fill: '#888' }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    //     this.sharePopup.add([bg, panel, title, desc, btnCopy, textCopy, btnClose]);

    //     btnClose.on('pointerdown', () => {
    //         this.sharePopup.setVisible(false);
    //         this.pendingShareBooster = null; // Hủy chờ share
    //     });

    //     btnCopy.on('pointerdown', () => {
    //         // Lưu link Github Pages của cậu vào Clipboard
    //         let gameLink = "https://dangthnh.github.io/Yang-Le-Ge-Yang-Clone/"; 
    //         navigator.clipboard.writeText(gameLink).then(() => {
    //             textCopy.setText('ĐÃ COPY!');
    //             btnCopy.setFillStyle(0xff9800);
                
    //             // MẸO TÂM LÝ: Chờ người chơi rời Tab (Ra Facebook/Zalo dán link)
    //             // Biến pendingShareBooster đã được gán tên chức năng từ lúc mở Popup
    //         });
    //     });
    // }

    registerVisibilityEvent() {
        // Hàm lắng nghe sự kiện Tab Trình duyệt
        this.visibilityHandler = () => {
            // Khi tab hiện lại (hidden == false) VÀ người chơi đang chờ nhận quà Share
            if (!document.hidden && this.pendingShareBooster) {
                // TẶNG QUÀ
                let bType = this.pendingShareBooster;
                this.boosters[bType].share = 0; // Trừ lượt Share (chỉ đc 1 lần)
                
                // Ẩn Popup
                this.sharePopup.setVisible(false);
                this.pendingShareBooster = null;
                
                // Kích hoạt luôn kỹ năng
                if (bType === 'shuffle') this.useShuffle();
                if (bType === 'undo') this.useUndo();
                if (bType === 'moveOut') this.useMoveOut();
                
                // Update UI nút
                this.updateBoosterUI();
            }
        };

        document.addEventListener("visibilitychange", this.visibilityHandler);
        
        // Xóa sự kiện khi Restart Scene để tránh bị lặp (Memory Leak)
        this.events.on('shutdown', () => {
            document.removeEventListener("visibilitychange", this.visibilityHandler);
        });
    }

    // Helper tạo giao diện Boosters
   
    createBoostersUI() {
        this.boosterBtns = {};

        const createBtn = (x, type, text) => {
            let btn = this.add.rectangle(x, 920, 100, 40, 0x2196f3).setInteractive({ useHandCursor: true });
            let label = this.add.text(x, 920, text, { fontSize: '18px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
            let icon = this.add.text(x, 890, '⭐', { fontSize: '20px' }).setOrigin(0.5);

            this.boosterBtns[type] = { btn, label, icon };

            btn.on('pointerdown', () => {
                if (this.isAnimating) return; // Khóa spam click
                
                let data = this.boosters[type];

                // TRÁNH NUỐT LƯỢT OAN UỔNG: Kiểm tra điều kiện TRƯỚC KHI xử lý bất cứ thứ gì
                if (type === 'moveOut' && this.slotBar.length === 0) {
                    console.log("Khay trống, không có gì để bốc!");
                    return; // Trả về luôn, không trừ lượt
                }
                if (type === 'undo' && this.slotBar.length === 0) {
                    console.log("Khay trống, không có gì để hoàn tác!");
                    return; // Trả về luôn, không trừ lượt
                }

                // Nếu có đủ đkiện thực thi, thì mới làm hiệu ứng nút lún xuống
                this.tweens.add({ targets: [btn, label], scale: 0.9, yoyo: true, duration: 50 });

                // DÙNG LƯỢT MIỄN PHÍ
                if (data.free > 0) {
                    data.free--;
                    if (type === 'shuffle') this.useShuffle();
                    if (type === 'undo') this.useUndo();
                    if (type === 'moveOut') this.useMoveOut();
                    this.updateBoosterUI();
                } 
                // DÙNG LƯỢT SHARE (Nếu hết Free và còn Share)
                else if (data.share > 0) {
                    this.pendingShareBooster = type;
                    // BẬT POPUP LÊN TRÊN CÙNG
                    this.sharePopup.setVisible(true); 
                    this.sharePopup.setDepth(999);
                }
            });
        };

        createBtn(120, 'shuffle', 'Đảo Bài');
        createBtn(270, 'undo', 'Hoàn Tác');
        createBtn(420, 'moveOut', 'Bốc Lên'); // Đổi tên thành "Bốc Lên" cho hợp lý

        this.updateBoosterUI();
    }

    updateBoosterUI() {
        ['shuffle', 'undo', 'moveOut'].forEach(type => {
            let data = this.boosters[type];
            let ui = this.boosterBtns[type];
            
            if (data.free > 0) {
                ui.icon.setText('Free');
                ui.btn.setFillStyle(0x4caf50); // Xanh lá
            } else if (data.share > 0) {
                ui.icon.setText('Share');
                ui.btn.setFillStyle(0xff9800); // Cam
            } else {
                ui.icon.setText('X');
                ui.btn.setFillStyle(0x777777); // Xám (Hết)
                // KHÔNG DISABLE INTERACTIVE Ở ĐÂY NỮA, để logic bên trên chặn lại
                // ui.btn.disableInteractive(); 
            }
        });
    }

    // =======================================================
    // SIÊU THUẬT TOÁN TẠO MAP ĐỊA NGỤC (YANG LE GE YANG CORE)
    // =======================================================
    generateHellModeLayout() {
        // AREA 1: TRUNG TÂM (Xếp chéo góc 30px, cao 18-22 tầng) ~ 150 lá
        let maxCenterLayers = Phaser.Math.Between(18, 22);
        for (let z = 0; z <= maxCenterLayers; z++) {
            // Càng lên cao diện tích càng ngẫu nhiên thu hẹp để tạo các "cầu nối" đứt gãy
            let isOdd = z % 2 !== 0;
            let offsetX = isOdd ? 30 : 0;
            let offsetY = isOdd ? 30 : 0;
            
            // Random kích thước khối trung tâm cho mỗi tầng
            let cols = Phaser.Math.Between(3, 5); 
            let rows = Phaser.Math.Between(4, 6);

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    // Xác suất 20% đục lỗ (khoét rỗng) để làm giảm số lá bài trên đỉnh, tăng độ khóa
                    if (z > 5 && Math.random() < 0.2) continue; 

                    let x = 120 + offsetX + (c * 60);
                    let y = 180 + offsetY + (r * 60);
                    this.mapLayout.push({ x: x, y: y, z: z, icon: null });
                }
            }
        }

        // AREA 2: VIỀN XUNG QUANH (Xếp lệch offset 25-30px lên xuống, cao 8-10 tầng) ~ 60 lá
        let maxSideLayers = Phaser.Math.Between(8, 10);
        let sidePositions = [
            { x: 60, y: 300 }, { x: 480, y: 300 }, // Rìa trên
            { x: 150, y: 600 }, { x: 270, y: 600 }, { x: 390, y: 600 } // Rìa dưới bao trọn
        ];
        
        for (let z = 0; z <= maxSideLayers; z++) {
            sidePositions.forEach(pos => {
                // Tầng chẵn lệch xuống 30px, tầng lẻ lệch lên 30px -> Lộ icon rất rõ
                let yOffset = (z % 2 === 0) ? (z * 15) : -(z * 15);
                this.mapLayout.push({ x: pos.x, y: pos.y + yOffset, z: z, icon: null });
            });
        }

        // AREA 3: CÁC CỌC BÀI MÙ (Blind Piles) - Cực kì sát nhau, cao 12-16 tầng ~ 50-60 lá
        let maxBlindLayers = Phaser.Math.Between(12, 16);
        let blindPositions = [
            { x: 90, y: 680 }, { x: 150, y: 680 }, // Cụm mù góc trái dưới
            { x: 390, y: 680 }, { x: 450, y: 680 }  // Cụm mù góc phải dưới
        ];

        for (let z = 0; z <= maxBlindLayers; z++) {
            blindPositions.forEach(pos => {
                // Thuật toán bẻ góc Cọc mù như cậu mô tả:
                // Z 0-10: Trượt ngang. Z 10+: Trượt dọc xuống.
                let xShift = 0;
                let yShift = 0;
                
                if (z <= 10) {
                    // Nếu bên trái màn hình (x < 270), trượt phải. Ngược lại trượt trái.
                    xShift = (pos.x < 270) ? (z * 2) : -(z * 2);
                } else {
                    // Giữ nguyên xShift của tầng 10, bắt đầu trượt Y xuống
                    xShift = (pos.x < 270) ? 20 : -20;
                    yShift = (z - 10) * 3;
                }

                this.mapLayout.push({ x: pos.x + xShift, y: pos.y + yShift, z: z, icon: null });
            });
        }
    }

    // =======================================================
    // CẬP NHẬT 15 LOẠI ICON Ở HÀM GENERATE SOLVABLE MAP
    // =======================================================
    generateSolvableMap() {
        // ĐÃ UPDATE ĐỦ 15 LOẠI ICON
        const iconTypes = [
            'bell', 'brush', 'carrot', 'bucket', 'cabbage',
            'campfire', 'corn', 'glove', 'grass', 'hay',
            'milk', 'pitchfork', 'shear', 'stump', 'yarn'
        ];

          let emptyPoints = [...this.mapLayout];
        emptyPoints.sort((a, b) => b.z - a.z);

        // Màn 1 Dễ (Diff 1), Màn 2 Khó (Diff 10)
      let difficulty = 10; 

        while (emptyPoints.length >= 3) {
            let randomIcon = iconTypes[Math.floor(Math.random() * iconTypes.length)];
            let chosenPoints = [];
            chosenPoints.push(emptyPoints.splice(0, 1)[0]);

            for (let i = 0; i < 2; i++) {
                let pIndex = (Math.random() * 10 > difficulty) ? 0 : Math.floor(Math.random() * emptyPoints.length);
                chosenPoints.push(emptyPoints.splice(pIndex, 1)[0]);
            }

            chosenPoints.forEach(p => p.icon = randomIcon);
            if (Math.random() > 0.5) emptyPoints.sort((a, b) => b.z - a.z);
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

   createSharePopup() {
        // Tạo container và đẩy nó lên tận Depth 9999 để đảm bảo đè lên mọi thứ
        this.sharePopup = this.add.container(0, 0).setDepth(9999).setVisible(false);
        
        let bg = this.add.rectangle(270, 480, 540, 960, 0x000000, 0.8).setInteractive(); 
        let panel = this.add.rectangle(270, 480, 400, 250, 0xffffff, 1).setStrokeStyle(4, 0x000000);
        let title = this.add.text(270, 400, 'HẾT LƯỢT MIỄN PHÍ!', { fontSize: '24px', fill: '#ff0000', fontStyle: 'bold' }).setOrigin(0.5);
        let desc = this.add.text(270, 450, 'Hãy Copy link game và chia sẻ\ncho bạn bè để nhận 1 lượt\ntrợ giúp ngay lập tức!', { fontSize: '18px', fill: '#333', align: 'center' }).setOrigin(0.5);
        
        let btnCopy = this.add.rectangle(270, 520, 200, 50, 0x4caf50).setInteractive({ useHandCursor: true });
        let textCopy = this.add.text(270, 520, 'COPY LINK', { fontSize: '18px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
        
        let btnClose = this.add.text(270, 570, 'Bỏ qua', { fontSize: '16px', fill: '#888' }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.sharePopup.add([bg, panel, title, desc, btnCopy, textCopy, btnClose]);

        btnClose.on('pointerdown', () => {
            this.sharePopup.setVisible(false);
            this.pendingShareBooster = null; 
            textCopy.setText('COPY LINK'); // Reset lại text
            btnCopy.setFillStyle(0x4caf50); // Reset lại màu xanh
        });

        btnCopy.on('pointerdown', () => {
            let gameLink = "https://dangthnh.github.io/Yang-Le-Ge-Yang-Clone/"; 
            navigator.clipboard.writeText(gameLink).then(() => {
                textCopy.setText('ĐÃ COPY!');
                btnCopy.setFillStyle(0xff9800);
                // Hệ thống Visibility Event sẽ lo phần còn lại khi người chơi chuyển Tab
            });
        });
    }

    createBoostersUI() {
        this.boosterBtns = {};

        const createBtn = (x, type, text) => {
            let btn = this.add.rectangle(x, 920, 100, 40, 0x2196f3).setInteractive({ useHandCursor: true });
            let label = this.add.text(x, 920, text, { fontSize: '18px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
            let icon = this.add.text(x, 890, '⭐', { fontSize: '20px' }).setOrigin(0.5);

            this.boosterBtns[type] = { btn, label, icon };

            btn.on('pointerdown', () => {
                if (this.isAnimating) return; 
                
                let data = this.boosters[type];

                // CHẶN NUỐT LƯỢT NẾU KHAY RỖNG
                if ((type === 'moveOut' || type === 'undo') && this.slotBar.length === 0) {
                    console.log("Không có thẻ trong khay để dùng Booster này!");
                    // Cho nút nhấp nháy báo lỗi nhẹ
                    this.tweens.add({ targets: [btn, label], alpha: 0.5, yoyo: true, duration: 100 });
                    return; 
                }

                // XỬ LÝ LƯỢT FREE
                if (data.free > 0) {
                    this.tweens.add({ targets: [btn, label], scale: 0.9, yoyo: true, duration: 50 });
                    data.free--;
                    
                    if (type === 'shuffle') this.useShuffle();
                    if (type === 'undo') this.useUndo();
                    if (type === 'moveOut') this.useMoveOut();
                    
                    this.updateBoosterUI(); // Gọi update để đổi màu sang Share
                } 
                // XỬ LÝ LƯỢT SHARE
                else if (data.share > 0) {
                    this.tweens.add({ targets: [btn, label], scale: 0.9, yoyo: true, duration: 50 });
                    
                    // Ghi nhớ người chơi đang đòi Share cái kỹ năng nào
                    this.pendingShareBooster = type;
                    
                    // BẬT POPUP SHARE ĐÒI MẠNG
                    this.sharePopup.setVisible(true);
                }
            });
        };

        createBtn(120, 'shuffle', 'Đảo Bài');
        createBtn(270, 'undo', 'Hoàn Tác');
        createBtn(420, 'moveOut', 'Bốc Lên');

        // Cập nhật UI ngay lúc mới load
        this.updateBoosterUI();
    }

    updateBoosterUI() {
        ['shuffle', 'undo', 'moveOut'].forEach(type => {
            let data = this.boosters[type];
            let ui = this.boosterBtns[type];
            
            if (data.free > 0) {
                ui.icon.setText('Free');
                ui.btn.setFillStyle(0x4caf50); 
                ui.btn.setInteractive({ useHandCursor: true }); // Luôn bật
            } else if (data.share > 0) {
                ui.icon.setText('Share');
                ui.btn.setFillStyle(0xff9800); 
                ui.btn.setInteractive({ useHandCursor: true }); // Luôn bật để gọi Popup
            } else {
                ui.icon.setText('X');
                ui.btn.setFillStyle(0x777777); 
                ui.btn.disableInteractive(); // Tắt vĩnh viễn
            }
        });
    }

    registerVisibilityEvent() {
        this.visibilityHandler = () => {
            if (!document.hidden && this.pendingShareBooster && this.sharePopup.visible) {
                // Thu hồi quà
                let bType = this.pendingShareBooster;
                this.boosters[bType].share = 0; 
                
                // Đóng Popup và Reset nó lại trạng thái gốc
                this.sharePopup.setVisible(false);
                this.pendingShareBooster = null;
                
                // Kích hoạt Booster
                if (bType === 'shuffle') this.useShuffle();
                if (bType === 'undo') this.useUndo();
                if (bType === 'moveOut') this.useMoveOut();
                
                // Nút sẽ chuyển sang màu xám
                this.updateBoosterUI();
            }
        };

        document.addEventListener("visibilitychange", this.visibilityHandler);
        
        this.events.on('shutdown', () => {
            document.removeEventListener("visibilitychange", this.visibilityHandler);
        });
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
                    
                    if (distanceX < (this.TILE_WIDTH - 0.5) && distanceY < (this.TILE_HEIGHT - 0.5)) {
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
        if (this.activeTiles.length === 0 && this.slotBar.length === 0) {
            this.isAnimating = true; 

            if (this.perfectSound) this.perfectSound.play(); 

            this.add.text(270, 480, `THẮNG!`, { 
                fontSize: '36px', fill: '#00ff00', fontStyle: 'bold', align: 'center', stroke: '#000', strokeThickness: 4
            }).setOrigin(0.5).setDepth(200);

            // THẮNG: LÊN MÀN CHƠI VÔ HẠN (Giữ nguyên lượt Booster)
            this.time.delayedCall(2000, () => {
                this.scene.restart({ 
                    levelIndex: this.currentLevelIndex + 1,
                    boosters: this.boosters 
                });
            });
        } 
        else if (this.slotBar.length >= this.MAX_SLOTS) {
            this.isAnimating = true; 

             if (this.gameoverSound) {
                this.gameoverSound.play({ volume: 1.0 });
            }
            
            this.add.rectangle(270, 480, 540, 960, 0x000000, 0.7).setDepth(199);
            this.add.text(270, 480, 'THUA!', { 
                fontSize: '50px', fill: '#ff0000', fontStyle: 'bold', align: 'center', stroke: '#000', strokeThickness: 6
            }).setOrigin(0.5).setDepth(200);

            // THUA: ÉP CHƠI LẠI MÀN HIỆN TẠI (Reset lại lượt Booster cho đỡ cay cú)
            this.time.delayedCall(2000, () => {
                this.scene.restart({ 
                    levelIndex: this.currentLevelIndex,
                    boosters: {
                        shuffle: { free: 1, share: 1 },
                        undo: { free: 1, share: 1 },
                        moveOut: { free: 1, share: 1 }
                    }
                });
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
    // BOOSTER 3: BỐC BÀI LÊN CHỜ (Bốc tối đa 3 lá đầu tiên trong khay)
    useMoveOut() {
        // Ta không cần lệnh if (this.slotBar.length < 3) return; nữa, 
        // vì điều kiện mảng = 0 đã bị chặn ở hàm tạo nút trên kia.

        this.isAnimating = true;

        // Tính toán số lá sẽ bốc: Lấy tối đa 3 lá, nếu khay chỉ có 1 hoặc 2 lá thì lấy hết
        let countToTake = Math.min(3, this.slotBar.length);
        
        // Cắt mảng
        let removedTiles = this.slotBar.splice(0, countToTake);
        this.waitArea = this.waitArea.concat(removedTiles);

        removedTiles.forEach((tile, index) => {
            // Sắp xếp các lá bài trên đài chờ dịch sang phải dựa theo số lượng lá bài hiện có ở đó
            // indexTrongKhuCho giúp các lá bài bốc sau không đè lên các lá bài bốc trước (nếu người chơi spam nút này)
            let indexTrongKhuCho = this.waitArea.indexOf(tile);
            
            let waitX = 150 + (indexTrongKhuCho * 70); 
            let waitY = 100;                

            tile.setInteractive({ useHandCursor: true });
            
            tile.off('pointerdown');
            tile.off('pointerup');
            tile.off('pointerout');
            
            // Xử lý Input khu vực chờ
            tile.on('pointerdown', () => {
                if (this.isAnimating) return;
                this.tweens.add({ targets: tile, scaleX: 1, scaleY: 1, y: waitY - 10, duration: 100 });
                tile.setDepth(200);
            });
            
            tile.on('pointerout', () => {
                if (this.isAnimating) return;
                this.tweens.add({ targets: tile, scaleX: 0.8, scaleY: 0.8, y: waitY, duration: 100 });
                tile.setDepth(150 + indexTrongKhuCho);
            });
            
            tile.on('pointerup', () => {
                if (this.isAnimating) return;
                
                // Trả bài về khay
                this.waitArea = this.waitArea.filter(t => t !== tile);
                tile.scaleX = 1; 
                tile.scaleY = 1; 
                this.onTileSelected(tile); 
            });

            // Tween bay lên bệ
            this.tweens.add({
                targets: tile,
                x: waitX, 
                y: waitY, 
                scaleX: 0.8, scaleY: 0.8, 
                duration: 300,
                ease: 'Cubic.easeOut',
            });
        });

        // Dồn toa lại Khay sau khi bốc
        this.time.delayedCall(300, () => {
            if (this.slotBar.length > 0) {
                this.rearrangeSlotBar(); 
            } else {
                this.isAnimating = false;
            }
        });
    }
}