/**
 * 中达国通电梯更新 - 主应用程序
 * 支持管理员权限控制、地图定位、在线数据共享
 */

// ========================================
// 配置和常量
// ========================================

const APP_CONFIG = {
    dbName: 'ElevatorUpdateDB',
    dbVersion: 2,
    projectStore: 'projects',
    photoStore: 'photos',
    // 管理员密码配置（实际应用中应该加密存储）
    adminPasswords: {
        admin1: '123456',  // 管理员1密码
        admin2: '123456',  // 管理员2密码
        admin3: '123456'   // 管理员3密码
    }
};

// 电梯更新流程步骤
const WORKFLOW_STEPS = [
    {
        id: 1,
        title: '拟定电梯更新改造方式',
        description: '申请人或代理人结合电梯日常运行使用和维保情况等因素，拟定老旧电梯更新改造方式。'
    },
    {
        id: 2,
        title: '委托专业机构开展安全评估',
        description: '委托专业机构开展安全评估。评估结论为更新或改造的继续后续流程。'
    },
    {
        id: 3,
        title: '编制更新改造方案',
        description: '更新改造方案应包括旧电梯基本情况，使用年限、拆除（维修）方式，新的电梯（或部件）品牌、型号、规格、配置、费用、施工周期等。'
    },
    {
        id: 4,
        title: '组织全体业主表决',
        description: '组织业主对电梯更新改造方案进行表决，参与率和同意率达到规定要求后，通过电梯更新改造方案。'
    },
    {
        id: 5,
        title: '组织招标',
        description: '明确电梯更新需求，发布招标公告，组织专业人员对投标方进行评审，选出中标单位。'
    },
    {
        id: 6,
        title: '组织项目实施',
        description: '中标后，签订委托施工合同，施工前向市场监管部门办理施工告知手续，落实安全防护措施。'
    },
    {
        id: 7,
        title: '办理监督检验和使用登记',
        description: '完工后，向特种设备检验机构申报监督检验，向市场监管部门办理特种设备使用登记证。'
    },
    {
        id: 8,
        title: '申请拨付补助资金',
        description: '竣工验收完成并取得特种设备使用登记证后，向街道（镇）提出财政补助申请。'
    }
];

// ========================================
// 数据库管理类
// ========================================

class DatabaseManager {
    constructor() {
        this.localDb = null;
    }

    async init() {
        await this.initLocalDb();
        return true;
    }

    async initLocalDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(APP_CONFIG.dbName, APP_CONFIG.dbVersion);

            request.onerror = () => reject(new Error('无法打开本地数据库'));

            request.onsuccess = (event) => {
                this.localDb = event.target.result;
                resolve(this.localDb);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(APP_CONFIG.projectStore)) {
                    const projectStore = db.createObjectStore(APP_CONFIG.projectStore, { keyPath: 'id' });
                    projectStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                if (!db.objectStoreNames.contains(APP_CONFIG.photoStore)) {
                    const photoStore = db.createObjectStore(APP_CONFIG.photoStore, { keyPath: 'id' });
                    photoStore.createIndex('projectId', 'projectId', { unique: false });
                    photoStore.createIndex('stepId', 'stepId', { unique: false });
                }
            };
        });
    }

    // 获取所有项目
    async getAllProjects() {
        return new Promise((resolve, reject) => {
            const transaction = this.localDb.transaction([APP_CONFIG.projectStore], 'readonly');
            const store = transaction.objectStore(APP_CONFIG.projectStore);
            const request = store.getAll();

            request.onsuccess = () => {
                const projects = request.result.sort((a, b) => 
                    new Date(b.createdAt) - new Date(a.createdAt)
                );
                resolve(projects);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // 获取单个项目
    async getProject(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.localDb.transaction([APP_CONFIG.projectStore], 'readonly');
            const store = transaction.objectStore(APP_CONFIG.projectStore);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // 保存项目
    async saveProject(project) {
        return new Promise((resolve, reject) => {
            const transaction = this.localDb.transaction([APP_CONFIG.projectStore], 'readwrite');
            const store = transaction.objectStore(APP_CONFIG.projectStore);
            const request = store.put(project);

            request.onsuccess = () => resolve(project);
            request.onerror = () => reject(request.error);
        });
    }

    // 删除项目
    async deleteProject(id) {
        // 先删除项目的所有照片
        const photos = await this.getPhotosByProject(id);
        for (const photo of photos) {
            await this.deletePhoto(photo.id);
        }

        return new Promise((resolve, reject) => {
            const transaction = this.localDb.transaction([APP_CONFIG.projectStore], 'readwrite');
            const store = transaction.objectStore(APP_CONFIG.projectStore);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // 上传照片（保存到本地）
    async uploadPhoto(file, projectId, stepId, onProgress) {
        const photoId = this.generateId();
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                const photo = {
                    id: photoId,
                    projectId,
                    stepId,
                    data: reader.result,
                    fileName: file.name,
                    uploadTime: new Date().toISOString(), // 上传时间
                    createdAt: new Date().toISOString()
                };

                try {
                    await this.savePhoto(photo);
                    if (onProgress) onProgress(100);
                    resolve(photo);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async savePhoto(photo) {
        return new Promise((resolve, reject) => {
            const transaction = this.localDb.transaction([APP_CONFIG.photoStore], 'readwrite');
            const store = transaction.objectStore(APP_CONFIG.photoStore);
            const request = store.put(photo);

            request.onsuccess = () => resolve(photo);
            request.onerror = () => reject(request.error);
        });
    }

    // 获取项目的所有照片
    async getPhotosByProject(projectId) {
        return new Promise((resolve, reject) => {
            const transaction = this.localDb.transaction([APP_CONFIG.photoStore], 'readonly');
            const store = transaction.objectStore(APP_CONFIG.photoStore);
            const index = store.index('projectId');
            const request = index.getAll(projectId);

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    // 获取步骤的所有照片
    async getPhotosByStep(projectId, stepId) {
        const allPhotos = await this.getPhotosByProject(projectId);
        return allPhotos.filter(p => p.stepId === stepId);
    }

    // 删除照片
    async deletePhoto(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.localDb.transaction([APP_CONFIG.photoStore], 'readwrite');
            const store = transaction.objectStore(APP_CONFIG.photoStore);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// ========================================
// 应用程序主类
// ========================================

class ElevatorUpdateApp {
    constructor() {
        this.db = new DatabaseManager();
        this.currentProject = null;
        this.currentStep = null;
        this.currentPhotos = [];
        this.currentPhotoIndex = 0;
        this.editingProjectId = null;
        this.allProjects = [];
        this.isAdmin = false;
        this.currentAdmin = null;
        this.map = null;
    }

    // 初始化应用
    async init() {
        this.showLoading();
        try {
            await this.db.init();
            this.checkAdminSession();
            this.updateAdminUI();
            this.bindEvents();
            this.updateDateDisplay();
            await this.loadProjects();
            console.log('中达国通电梯更新系统已启动');
        } catch (error) {
            console.error('初始化失败:', error);
            this.showToast('系统初始化失败，请刷新页面重试', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // 检查管理员会话
    checkAdminSession() {
        const savedAdmin = localStorage.getItem('currentAdmin');
        if (savedAdmin) {
            this.isAdmin = true;
            this.currentAdmin = savedAdmin;
        }
    }

    // 更新管理员UI
    updateAdminUI() {
        const adminElements = document.querySelectorAll('.admin-only');
        const visitorHint = document.getElementById('visitorHint');
        const adminText = document.getElementById('adminText');
        const btnAdminLogin = document.getElementById('btnAdminLogin');

        if (this.isAdmin) {
            adminElements.forEach(el => el.style.display = '');
            if (visitorHint) visitorHint.style.display = 'none';
            adminText.textContent = this.currentAdmin || '管理员';
            btnAdminLogin.textContent = '🚪 退出';
            btnAdminLogin.title = '退出登录';
        } else {
            adminElements.forEach(el => el.style.display = 'none');
            if (visitorHint) visitorHint.style.display = '';
            adminText.textContent = '访客模式';
            btnAdminLogin.textContent = '🔐 登录';
            btnAdminLogin.title = '管理员登录';
        }
    }

    // 显示/隐藏加载
    showLoading() {
        document.getElementById('loadingOverlay').classList.add('active');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('active');
    }

    // 绑定事件
    bindEvents() {
        // 管理员登录
        document.getElementById('btnAdminLogin').addEventListener('click', () => {
            if (this.isAdmin) {
                this.adminLogout();
            } else {
                this.openAdminModal();
            }
        });
        document.getElementById('closeAdminModal').addEventListener('click', () => this.closeAdminModal());
        document.getElementById('cancelAdminModal').addEventListener('click', () => this.closeAdminModal());
        document.getElementById('confirmAdminLogin').addEventListener('click', () => this.adminLogin());

        // 新建项目按钮
        document.getElementById('btnAddProject').addEventListener('click', () => this.openProjectModal());
        document.getElementById('btnCreateFirst').addEventListener('click', () => this.openProjectModal());

        // 项目模态框
        document.getElementById('closeProjectModal').addEventListener('click', () => this.closeProjectModal());
        document.getElementById('cancelProjectModal').addEventListener('click', () => this.closeProjectModal());
        document.getElementById('saveProject').addEventListener('click', () => this.saveProject());

        // 项目操作
        document.getElementById('btnEditProject').addEventListener('click', () => this.editCurrentProject());
        document.getElementById('btnDeleteProject').addEventListener('click', () => this.deleteCurrentProject());
        
        // 地图操作
        document.getElementById('btnShowMap').addEventListener('click', () => this.toggleMap());
        document.getElementById('btnCloseMap').addEventListener('click', () => this.hideMap());

        // 照片模态框
        document.getElementById('closePhotoModal').addEventListener('click', () => this.closePhotoModal());
        document.getElementById('cancelPhotoModal').addEventListener('click', () => this.closePhotoModal());
        document.getElementById('btnUploadPhoto').addEventListener('click', () => this.triggerPhotoUpload());

        // 照片上传
        const uploadArea = document.getElementById('uploadArea');
        const photoInput = document.getElementById('photoInput');

        uploadArea.addEventListener('click', () => photoInput.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            this.handlePhotoFiles(e.dataTransfer.files);
        });
        photoInput.addEventListener('change', (e) => {
            this.handlePhotoFiles(e.target.files);
            e.target.value = '';
        });

        // 预览模态框
        document.getElementById('closePreviewModal').addEventListener('click', () => this.closePreviewModal());
        document.getElementById('prevPhoto').addEventListener('click', () => this.showPrevPhoto());
        document.getElementById('nextPhoto').addEventListener('click', () => this.showNextPhoto());
        document.getElementById('deletePhoto').addEventListener('click', () => this.deleteCurrentPhoto());

        // 确认对话框
        document.getElementById('cancelConfirm').addEventListener('click', () => this.closeConfirmModal());

        // 搜索功能
        document.getElementById('searchProject').addEventListener('input', (e) => {
            this.filterProjects(e.target.value);
        });

        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
            if (document.getElementById('previewModal').classList.contains('active')) {
                if (e.key === 'ArrowLeft') this.showPrevPhoto();
                if (e.key === 'ArrowRight') this.showNextPhoto();
            }
        });

        // 点击模态框外部关闭
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    // ========================================
    // 管理员功能
    // ========================================

    openAdminModal() {
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminModal').classList.add('active');
    }

    closeAdminModal() {
        document.getElementById('adminModal').classList.remove('active');
    }

    adminLogin() {
        const adminSelect = document.getElementById('adminSelect').value;
        const password = document.getElementById('adminPassword').value;

        if (APP_CONFIG.adminPasswords[adminSelect] === password) {
            this.isAdmin = true;
            this.currentAdmin = adminSelect === 'admin1' ? '管理员1' : 
                               adminSelect === 'admin2' ? '管理员2' : '管理员3';
            localStorage.setItem('currentAdmin', this.currentAdmin);
            this.updateAdminUI();
            this.closeAdminModal();
            this.showToast(`${this.currentAdmin} 登录成功`, 'success');
        } else {
            this.showToast('密码错误', 'error');
        }
    }

    adminLogout() {
        this.isAdmin = false;
        this.currentAdmin = null;
        localStorage.removeItem('currentAdmin');
        this.updateAdminUI();
        this.showToast('已退出登录', 'success');
    }

    // 更新日期显示
    updateDateDisplay() {
        const now = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        document.getElementById('currentDate').textContent = now.toLocaleDateString('zh-CN', options);
    }

    // ========================================
    // 地图功能
    // ========================================

    toggleMap() {
        const mapContainer = document.getElementById('mapContainer');
        if (mapContainer.style.display === 'none') {
            this.showMap();
        } else {
            this.hideMap();
        }
    }

    showMap() {
        const mapContainer = document.getElementById('mapContainer');
        mapContainer.style.display = 'block';
        
        // 如果有坐标，显示地图
        if (this.currentProject && this.currentProject.coords) {
            const coords = this.currentProject.coords.split(',');
            if (coords.length === 2) {
                const lng = parseFloat(coords[0]);
                const lat = parseFloat(coords[1]);
                
                // 使用简单的静态地图图片
                const mapView = document.getElementById('mapView');
                mapView.innerHTML = `
                    <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#e8f0fe; border-radius:8px;">
                        <div style="text-align:center;">
                            <div style="font-size:48px; margin-bottom:16px;">📍</div>
                            <p style="color:#1a73e8; font-weight:600;">${this.currentProject.address || '项目位置'}</p>
                            <p style="color:#666; font-size:12px;">坐标：${lng}, ${lat}</p>
                            <a href="https://uri.amap.com/marker?position=${lng},${lat}&name=${encodeURIComponent(this.currentProject.name)}" 
                               target="_blank" 
                               style="display:inline-block; margin-top:12px; padding:8px 16px; background:#1a73e8; color:white; border-radius:4px; text-decoration:none;">
                                在高德地图中打开
                            </a>
                        </div>
                    </div>
                `;
            }
        } else {
            const mapView = document.getElementById('mapView');
            mapView.innerHTML = `
                <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#f5f5f5; border-radius:8px;">
                    <div style="text-align:center; color:#999;">
                        <div style="font-size:48px; margin-bottom:16px;">🗺️</div>
                        <p>暂未设置项目位置</p>
                        <p style="font-size:12px;">请编辑项目添加地图坐标</p>
                    </div>
                </div>
            `;
        }
    }

    hideMap() {
        document.getElementById('mapContainer').style.display = 'none';
    }

    // ========================================
    // 项目管理
    // ========================================

    async loadProjects() {
        try {
            this.allProjects = await this.db.getAllProjects();
            this.renderProjectList(this.allProjects);
        } catch (error) {
            console.error('加载项目失败:', error);
            this.showToast('加载项目失败', 'error');
        }
    }

    filterProjects(keyword) {
        const filtered = this.allProjects.filter(p => 
            p.name.toLowerCase().includes(keyword.toLowerCase()) ||
            (p.address && p.address.toLowerCase().includes(keyword.toLowerCase()))
        );
        this.renderProjectList(filtered);
    }

    renderProjectList(projects) {
        const container = document.getElementById('projectList');
        
        if (projects.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <p>暂无项目</p>
                </div>
            `;
            return;
        }

        container.innerHTML = projects.map(project => {
            const progress = this.calculateProgress(project);
            const isCompleted = progress === 100;
            return `
                <div class="project-item ${this.currentProject?.id === project.id ? 'active' : ''} ${isCompleted ? 'completed' : ''}" 
                     data-id="${project.id}">
                    <div class="project-item-icon">${isCompleted ? '✅' : '🛗'}</div>
                    <div class="project-item-info">
                        <div class="project-item-name">${this.escapeHtml(project.name)}</div>
                        <div class="project-item-date">${this.formatDate(project.createdAt)}</div>
                        <div class="project-item-progress">
                            <div class="progress-bar ${isCompleted ? 'completed' : ''}">
                                <div class="progress-fill ${isCompleted ? 'completed' : ''}" style="width: ${progress}%"></div>
                            </div>
                            <span class="progress-text ${isCompleted ? 'completed' : ''}">${isCompleted ? '已完成' : progress + '%'}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.project-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                this.selectProject(id);
            });
        });
    }

    calculateProgress(project) {
        if (!project.steps) return 0;
        const completed = project.steps.filter(s => s.status === 'completed').length;
        return Math.round((completed / WORKFLOW_STEPS.length) * 100);
    }

    async selectProject(id) {
        try {
            const project = await this.db.getProject(id);
            if (!project) {
                this.showToast('项目不存在', 'error');
                return;
            }

            this.currentProject = project;
            
            document.querySelectorAll('.project-item').forEach(item => {
                item.classList.toggle('active', item.dataset.id === id);
            });

            document.getElementById('welcomePage').style.display = 'none';
            document.getElementById('projectDetail').style.display = 'block';
            this.hideMap();
            
            await this.renderProjectDetail();
        } catch (error) {
            console.error('加载项目详情失败:', error);
            this.showToast('加载项目详情失败', 'error');
        }
    }

    async renderProjectDetail() {
        const project = this.currentProject;
        const progress = this.calculateProgress(project);
        const isCompleted = progress === 100;
        
        document.getElementById('projectTitle').textContent = project.name;
        document.getElementById('projectDate').textContent = `📅 创建于 ${this.formatDate(project.createdAt)}`;
        document.getElementById('projectAddress').textContent = project.address ? `📍 ${project.address}` : '';
        
        // 更新进度条
        const progressFill = document.getElementById('progressFill');
        const progressOverview = document.getElementById('progressOverview');
        progressFill.style.width = `${progress}%`;
        
        if (isCompleted) {
            progressFill.classList.add('completed');
            progressOverview.classList.add('completed');
        } else {
            progressFill.classList.remove('completed');
            progressOverview.classList.remove('completed');
        }
        
        const completedCount = project.steps ? project.steps.filter(s => s.status === 'completed').length : 0;
        document.getElementById('progressText').textContent = `${completedCount}/${WORKFLOW_STEPS.length} 步骤完成`;
        document.getElementById('progressPercent').textContent = `${progress}%`;

        // 更新状态徽章
        const badge = document.getElementById('projectBadge');
        if (isCompleted) {
            badge.textContent = '✅ 已完成';
            badge.className = 'project-badge completed';
        } else if (progress > 0) {
            badge.textContent = '进行中';
            badge.className = 'project-badge';
        } else {
            badge.textContent = '待开始';
            badge.className = 'project-badge';
        }

        // 获取项目所有照片
        const allPhotos = await this.db.getPhotosByProject(project.id);

        // 渲染步骤
        const container = document.getElementById('stepsContainer');
        container.innerHTML = WORKFLOW_STEPS.map((step, index) => {
            const stepData = project.steps?.find(s => s.id === step.id) || { id: step.id, status: 'pending' };
            const photos = allPhotos.filter(p => p.stepId === step.id);
            const isStepCompleted = stepData.status === 'completed';
            const statusClass = isStepCompleted ? 'completed' : 
                               stepData.status === 'in-progress' ? 'in-progress' : '';
            
            return `
                <div class="step-card ${statusClass}" data-step-id="${step.id}">
                    <div class="step-header">
                        <div class="step-number">${isStepCompleted ? '✓' : index + 1}</div>
                        <div class="step-title">${step.title}</div>
                        <div class="step-status">
                            <div class="photo-count">
                                <span>📷</span>
                                <span>${photos.length}</span>
                            </div>
                            ${this.isAdmin ? `
                            <select class="step-status-select" data-step-id="${step.id}">
                                <option value="pending" ${stepData.status === 'pending' ? 'selected' : ''}>待开始</option>
                                <option value="in-progress" ${stepData.status === 'in-progress' ? 'selected' : ''}>进行中</option>
                                <option value="completed" ${stepData.status === 'completed' ? 'selected' : ''}>已完成</option>
                            </select>
                            ` : `
                            <span class="step-status-text ${statusClass}">${
                                stepData.status === 'completed' ? '已完成' :
                                stepData.status === 'in-progress' ? '进行中' : '待开始'
                            }</span>
                            `}
                        </div>
                    </div>
                    <div class="step-content">
                        <div class="step-description">${step.description}</div>
                        <div class="step-photos">
                            ${photos.slice(0, 5).map(photo => `
                                <div class="photo-thumb-container">
                                    <img src="${photo.url || photo.data}" class="photo-thumb" data-photo-id="${photo.id}" 
                                         onclick="app.openPreviewFromStep('${photo.id}', ${step.id})">
                                    <span class="photo-time">${this.formatDateTime(photo.uploadTime || photo.createdAt)}</span>
                                </div>
                            `).join('')}
                            ${photos.length > 5 ? `<span style="color: var(--gray-500); align-self: center; font-size: 13px;">+${photos.length - 5} 更多</span>` : ''}
                        </div>
                        <button class="btn-upload-photo" onclick="app.openPhotoModal(${step.id})">
                            <span>📷</span> ${this.isAdmin ? '管理照片' : '查看照片'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // 绑定状态选择事件
        if (this.isAdmin) {
            container.querySelectorAll('.step-status-select').forEach(select => {
                select.addEventListener('change', (e) => {
                    e.stopPropagation();
                    const stepId = parseInt(select.dataset.stepId);
                    this.updateStepStatus(stepId, select.value);
                });
            });
        }
    }

    async updateStepStatus(stepId, status) {
        if (!this.isAdmin) {
            this.showToast('需要管理员权限', 'error');
            return;
        }

        try {
            if (!this.currentProject.steps) {
                this.currentProject.steps = WORKFLOW_STEPS.map(s => ({ id: s.id, status: 'pending' }));
            }

            const step = this.currentProject.steps.find(s => s.id === stepId);
            if (step) {
                step.status = status;
            } else {
                this.currentProject.steps.push({ id: stepId, status });
            }

            this.currentProject.updatedAt = new Date().toISOString();
            await this.db.saveProject(this.currentProject);
            await this.loadProjects();
            await this.renderProjectDetail();
            this.showToast('状态已更新', 'success');
        } catch (error) {
            console.error('更新状态失败:', error);
            this.showToast('更新状态失败', 'error');
        }
    }

    openProjectModal(editProject = null) {
        if (!this.isAdmin) {
            this.showToast('需要管理员权限', 'error');
            return;
        }

        this.editingProjectId = editProject?.id || null;
        
        document.getElementById('modalTitle').textContent = editProject ? '编辑项目' : '新建项目';
        document.getElementById('projectName').value = editProject?.name || '';
        document.getElementById('projectAddress').value = editProject?.address || '';
        document.getElementById('projectCoords').value = editProject?.coords || '';
        document.getElementById('projectType').value = editProject?.type || 'type2';
        document.getElementById('elevatorCount').value = editProject?.elevatorCount || 1;
        document.getElementById('projectNote').value = editProject?.note || '';
        
        document.getElementById('projectModal').classList.add('active');
        document.getElementById('projectName').focus();
    }

    closeProjectModal() {
        document.getElementById('projectModal').classList.remove('active');
        this.editingProjectId = null;
    }

    async saveProject() {
        if (!this.isAdmin) {
            this.showToast('需要管理员权限', 'error');
            return;
        }

        const name = document.getElementById('projectName').value.trim();
        const address = document.getElementById('projectAddress').value.trim();
        const coords = document.getElementById('projectCoords').value.trim();
        const type = document.getElementById('projectType').value;
        const elevatorCount = parseInt(document.getElementById('elevatorCount').value) || 1;
        const note = document.getElementById('projectNote').value.trim();

        if (!name) {
            this.showToast('请输入项目名称', 'error');
            document.getElementById('projectName').focus();
            return;
        }

        this.showLoading();
        try {
            let project;
            if (this.editingProjectId) {
                project = await this.db.getProject(this.editingProjectId);
                project.name = name;
                project.address = address;
                project.coords = coords;
                project.type = type;
                project.elevatorCount = elevatorCount;
                project.note = note;
                project.updatedAt = new Date().toISOString();
            } else {
                project = {
                    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                    name,
                    address,
                    coords,
                    type,
                    elevatorCount,
                    note,
                    steps: WORKFLOW_STEPS.map(s => ({ id: s.id, status: 'pending' })),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }

            await this.db.saveProject(project);
            this.closeProjectModal();
            await this.loadProjects();
            
            if (!this.editingProjectId) {
                this.selectProject(project.id);
            } else {
                this.currentProject = project;
                this.renderProjectDetail();
            }
            
            this.showToast(this.editingProjectId ? '项目已更新' : '项目创建成功', 'success');
        } catch (error) {
            console.error('保存项目失败:', error);
            this.showToast('保存项目失败', 'error');
        } finally {
            this.hideLoading();
        }
    }

    editCurrentProject() {
        if (this.currentProject) {
            this.openProjectModal(this.currentProject);
        }
    }

    deleteCurrentProject() {
        if (!this.isAdmin) {
            this.showToast('需要管理员权限', 'error');
            return;
        }

        if (!this.currentProject) return;

        this.showConfirm(`确定要删除项目"${this.currentProject.name}"吗？\n此操作将删除所有相关照片，且不可恢复！`, async () => {
            this.showLoading();
            try {
                await this.db.deleteProject(this.currentProject.id);
                this.currentProject = null;
                
                document.getElementById('welcomePage').style.display = 'flex';
                document.getElementById('projectDetail').style.display = 'none';
                
                await this.loadProjects();
                this.showToast('项目已删除', 'success');
            } catch (error) {
                console.error('删除项目失败:', error);
                this.showToast('删除项目失败', 'error');
            } finally {
                this.hideLoading();
            }
        });
    }

    // ========================================
    // 照片管理
    // ========================================

    async openPhotoModal(stepId) {
        this.currentStep = stepId;
        const step = WORKFLOW_STEPS.find(s => s.id === stepId);
        document.getElementById('photoModalTitle').textContent = `${step.title} - ${this.isAdmin ? '照片管理' : '查看照片'}`;
        
        await this.loadStepPhotos();
        document.getElementById('photoModal').classList.add('active');
    }

    closePhotoModal() {
        document.getElementById('photoModal').classList.remove('active');
        document.getElementById('uploadProgress').style.display = 'none';
        this.currentStep = null;
        if (this.currentProject) {
            this.renderProjectDetail();
        }
    }

    async loadStepPhotos() {
        try {
            const photos = await this.db.getPhotosByStep(this.currentProject.id, this.currentStep);
            this.currentPhotos = photos;
            this.renderPhotoGallery(photos);
        } catch (error) {
            console.error('加载照片失败:', error);
            this.showToast('加载照片失败', 'error');
        }
    }

    renderPhotoGallery(photos) {
        const container = document.getElementById('photoGallery');
        
        if (photos.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无照片</p></div>';
            return;
        }

        container.innerHTML = photos.map((photo, index) => `
            <div class="gallery-item" onclick="app.openPreview(${index})">
                <img src="${photo.url || photo.data}" alt="照片">
                <div class="photo-upload-time">📅 ${this.formatDateTime(photo.uploadTime || photo.createdAt)}</div>
                ${this.isAdmin ? `<button class="delete-btn" onclick="event.stopPropagation(); app.deletePhotoById('${photo.id}')">&times;</button>` : ''}
            </div>
        `).join('');
    }

    triggerPhotoUpload() {
        if (!this.isAdmin) {
            this.showToast('需要管理员权限', 'error');
            return;
        }
        document.getElementById('photoInput').click();
    }

    async handlePhotoFiles(files) {
        if (!this.isAdmin) {
            this.showToast('需要管理员权限', 'error');
            return;
        }

        if (!files || files.length === 0) return;

        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 10 * 1024 * 1024;
        let uploadCount = 0;
        const totalFiles = files.length;

        document.getElementById('uploadProgress').style.display = 'block';

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            if (!validTypes.includes(file.type)) {
                this.showToast(`不支持的文件格式: ${file.name}`, 'error');
                continue;
            }

            if (file.size > maxSize) {
                this.showToast(`文件过大: ${file.name}（最大10MB）`, 'error');
                continue;
            }

            try {
                document.getElementById('uploadProgressText').textContent = 
                    `正在上传 ${i + 1}/${totalFiles}: ${file.name}`;

                await this.db.uploadPhoto(
                    file, 
                    this.currentProject.id, 
                    this.currentStep,
                    (progress) => {
                        document.getElementById('uploadProgressFill').style.width = `${progress}%`;
                    }
                );
                uploadCount++;
            } catch (error) {
                console.error('上传照片失败:', error);
                this.showToast(`上传失败: ${file.name}`, 'error');
            }
        }

        document.getElementById('uploadProgress').style.display = 'none';
        document.getElementById('uploadProgressFill').style.width = '0%';

        if (uploadCount > 0) {
            this.showToast(`成功上传 ${uploadCount} 张照片`, 'success');
            await this.loadStepPhotos();
        }
    }

    async openPreviewFromStep(photoId, stepId) {
        this.currentStep = stepId;
        const photos = await this.db.getPhotosByStep(this.currentProject.id, stepId);
        this.currentPhotos = photos;
        const index = photos.findIndex(p => p.id === photoId);
        if (index >= 0) {
            this.openPreview(index);
        }
    }

    openPreview(index) {
        this.currentPhotoIndex = index;
        this.updatePreviewImage();
        document.getElementById('previewModal').classList.add('active');
    }

    closePreviewModal() {
        document.getElementById('previewModal').classList.remove('active');
    }

    updatePreviewImage() {
        const photo = this.currentPhotos[this.currentPhotoIndex];
        if (photo) {
            document.getElementById('previewImage').src = photo.url || photo.data;
            document.getElementById('previewInfo').textContent = 
                `${this.currentPhotoIndex + 1} / ${this.currentPhotos.length} - 上传于 ${this.formatDateTime(photo.uploadTime || photo.createdAt)}`;
        }
    }

    showPrevPhoto() {
        if (this.currentPhotoIndex > 0) {
            this.currentPhotoIndex--;
            this.updatePreviewImage();
        }
    }

    showNextPhoto() {
        if (this.currentPhotoIndex < this.currentPhotos.length - 1) {
            this.currentPhotoIndex++;
            this.updatePreviewImage();
        }
    }

    deleteCurrentPhoto() {
        const photo = this.currentPhotos[this.currentPhotoIndex];
        if (photo) {
            this.deletePhotoById(photo.id);
        }
    }

    async deletePhotoById(id) {
        if (!this.isAdmin) {
            this.showToast('需要管理员权限', 'error');
            return;
        }

        this.showConfirm('确定要删除这张照片吗？', async () => {
            try {
                await this.db.deletePhoto(id);
                this.showToast('照片已删除', 'success');
                
                await this.loadStepPhotos();
                
                if (document.getElementById('previewModal').classList.contains('active')) {
                    if (this.currentPhotos.length === 0) {
                        this.closePreviewModal();
                    } else {
                        if (this.currentPhotoIndex >= this.currentPhotos.length) {
                            this.currentPhotoIndex = this.currentPhotos.length - 1;
                        }
                        this.updatePreviewImage();
                    }
                }
            } catch (error) {
                console.error('删除照片失败:', error);
                this.showToast('删除照片失败', 'error');
            }
        });
    }

    // ========================================
    // 工具函数
    // ========================================

    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    formatDateTime(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast show';
        if (type) {
            toast.classList.add(type);
        }
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    showConfirm(message, onConfirm) {
        document.getElementById('confirmMessage').textContent = message;
        document.getElementById('confirmModal').classList.add('active');
        
        const confirmBtn = document.getElementById('confirmAction');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            this.closeConfirmModal();
            onConfirm();
        });
    }

    closeConfirmModal() {
        document.getElementById('confirmModal').classList.remove('active');
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }
}

// ========================================
// 启动应用
// ========================================

let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new ElevatorUpdateApp();
    app.init();
});
