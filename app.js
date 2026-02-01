/**
 * 中达国通电梯更新 - 主应用程序
 * 支持 LeanCloud 云存储（国内可用）和本地 IndexedDB 双模式
 */

// ========================================
// 配置和常量
// ========================================

const APP_CONFIG = {
    dbName: 'ElevatorUpdateDB',
    dbVersion: 1,
    projectStore: 'projects',
    photoStore: 'photos'
};

// 电梯更新流程步骤
const WORKFLOW_STEPS = [
    {
        id: 1,
        title: '拟定电梯更新改造方式',
        description: '申请人或代理人结合电梯日常运行使用和维保情况等因素，拟定老旧电梯更新改造方式。按照更新方式实施的，每台电梯定额补贴15万元；按照改造方式实施的，每台电梯定额补贴5万元。'
    },
    {
        id: 2,
        title: '委托专业机构开展安全评估',
        description: '委托专业机构开展安全评估。评估结论为更新或改造的继续后续流程；评估结论为重大维修或一般维修的不适用本流程，按照现行相关规定进行维修。'
    },
    {
        id: 3,
        title: '编制更新改造方案',
        description: '更新改造方案应包括旧电梯基本情况，使用年限、拆除（维修）方式，新的电梯（或部件）品牌、型号、规格、配置、费用、施工周期，预算费用、资金来源、业主分摊金额、后续管理及维保方式等具体内容。'
    },
    {
        id: 4,
        title: '组织全体业主表决',
        description: '更新改造方案经征求业主意见并修改完善后，按照《中华人民共和国民法典》第二百七十八条规定，组织业主对电梯更新改造方案进行表决，参与率和同意率达到规定要求后，通过电梯更新改造方案。'
    },
    {
        id: 5,
        title: '组织招标',
        description: '明确电梯更新需求，电梯的数量、型号、功能要求、预算范围等，发布招标公告，组织专业人员对投标方进行评审，综合考虑价格、技术、信誉等因素，选出中标单位。'
    },
    {
        id: 6,
        title: '组织项目实施',
        description: '中标后，签订委托施工合同，施工前向市场监管部门办理施工告知手续，及时向业主公开施工工期、进度等信息，合理安排施工时序，落实安全防护措施。'
    },
    {
        id: 7,
        title: '办理监督检验和使用登记',
        description: '完工后，向特种设备检验机构申报监督检验，未经检验或者检验不合格的电梯不得投入使用。在电梯投入使用前或投入使用后30日内，向市场监管部门办理特种设备使用登记证。'
    },
    {
        id: 8,
        title: '申请拨付补助资金',
        description: '住宅老旧电梯更新改造竣工验收完成并取得特种设备使用登记证后，申请人或代理人持电梯更新改造方案、业主意见表决结果、施工合同、电梯检验合格证、使用登记证及费用支付凭证等材料向街道（镇）提出财政补助申请，街道汇总后报县区住建局，经审核后，由县区财政局拨付补助资金。'
    }
];

// ========================================
// 数据库管理类 - 支持 LeanCloud 和 IndexedDB
// ========================================

class DatabaseManager {
    constructor() {
        this.localDb = null;
        this.useCloud = typeof isLeanCloudConfigured !== 'undefined' && isLeanCloudConfigured;
    }

    // 初始化数据库
    async init() {
        // 初始化本地 IndexedDB 作为备份
        await this.initLocalDb();
        
        if (this.useCloud) {
            console.log('使用 LeanCloud 云存储模式');
        } else {
            console.log('使用本地存储模式');
        }
        
        return true;
    }

    // 初始化本地 IndexedDB
    async initLocalDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(APP_CONFIG.dbName, APP_CONFIG.dbVersion);

            request.onerror = () => {
                reject(new Error('无法打开本地数据库'));
            };

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

    // ========================================
    // 项目操作
    // ========================================

    // 获取所有项目
    async getAllProjects() {
        if (this.useCloud) {
            try {
                const query = new AV.Query('Project');
                query.descending('createdAt');
                const results = await query.find();
                return results.map(item => ({
                    id: item.id,
                    ...item.toJSON()
                }));
            } catch (error) {
                console.error('云端获取项目失败:', error);
                return this.getAllProjectsLocal();
            }
        }
        return this.getAllProjectsLocal();
    }

    async getAllProjectsLocal() {
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
        if (this.useCloud) {
            try {
                const query = new AV.Query('Project');
                const result = await query.get(id);
                return {
                    id: result.id,
                    ...result.toJSON()
                };
            } catch (error) {
                console.error('云端获取项目失败:', error);
                return this.getProjectLocal(id);
            }
        }
        return this.getProjectLocal(id);
    }

    async getProjectLocal(id) {
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
        if (this.useCloud) {
            try {
                let avProject;
                if (project.objectId) {
                    // 更新现有项目
                    avProject = AV.Object.createWithoutData('Project', project.objectId);
                } else if (project.id && project.id.length === 24) {
                    // 可能是已存在的项目
                    try {
                        avProject = AV.Object.createWithoutData('Project', project.id);
                    } catch (e) {
                        avProject = new AV.Object('Project');
                    }
                } else {
                    avProject = new AV.Object('Project');
                }
                
                // 设置所有字段
                Object.keys(project).forEach(key => {
                    if (key !== 'id' && key !== 'objectId') {
                        avProject.set(key, project[key]);
                    }
                });
                
                const saved = await avProject.save();
                return {
                    id: saved.id,
                    objectId: saved.id,
                    ...saved.toJSON()
                };
            } catch (error) {
                console.error('云端保存项目失败:', error);
                return this.saveProjectLocal(project);
            }
        }
        return this.saveProjectLocal(project);
    }

    async saveProjectLocal(project) {
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
            await this.deletePhoto(photo.id || photo.objectId);
        }

        if (this.useCloud) {
            try {
                const project = AV.Object.createWithoutData('Project', id);
                await project.destroy();
                return;
            } catch (error) {
                console.error('云端删除项目失败:', error);
                return this.deleteProjectLocal(id);
            }
        }
        return this.deleteProjectLocal(id);
    }

    async deleteProjectLocal(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.localDb.transaction([APP_CONFIG.projectStore], 'readwrite');
            const store = transaction.objectStore(APP_CONFIG.projectStore);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ========================================
    // 照片操作
    // ========================================

    // 上传照片
    async uploadPhoto(file, projectId, stepId, onProgress) {
        const photoId = this.generateId();
        
        if (this.useCloud) {
            try {
                // 创建 LeanCloud 文件
                const avFile = new AV.File(file.name, file);
                
                // 上传文件
                await avFile.save({
                    onProgress: (progress) => {
                        if (onProgress) {
                            onProgress(progress.percent);
                        }
                    }
                });

                // 创建照片记录
                const Photo = AV.Object.extend('Photo');
                const photo = new Photo();
                photo.set('projectId', projectId);
                photo.set('stepId', stepId);
                photo.set('file', avFile);
                photo.set('url', avFile.url());
                photo.set('fileName', file.name);
                
                const saved = await photo.save();
                
                return {
                    id: saved.id,
                    objectId: saved.id,
                    projectId,
                    stepId,
                    url: avFile.url(),
                    fileName: file.name,
                    createdAt: saved.createdAt.toISOString()
                };
            } catch (error) {
                console.error('云端上传失败:', error);
                return this.uploadPhotoLocal(file, projectId, stepId, photoId);
            }
        }
        return this.uploadPhotoLocal(file, projectId, stepId, photoId);
    }

    async uploadPhotoLocal(file, projectId, stepId, photoId) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                const photo = {
                    id: photoId,
                    projectId,
                    stepId,
                    data: reader.result,
                    fileName: file.name,
                    createdAt: new Date().toISOString()
                };

                try {
                    await this.savePhotoLocal(photo);
                    resolve(photo);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async savePhotoLocal(photo) {
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
        if (this.useCloud) {
            try {
                const query = new AV.Query('Photo');
                query.equalTo('projectId', projectId);
                query.descending('createdAt');
                const results = await query.find();
                return results.map(item => ({
                    id: item.id,
                    objectId: item.id,
                    ...item.toJSON(),
                    url: item.get('url')
                }));
            } catch (error) {
                console.error('云端获取照片失败:', error);
                return this.getPhotosByProjectLocal(projectId);
            }
        }
        return this.getPhotosByProjectLocal(projectId);
    }

    async getPhotosByProjectLocal(projectId) {
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
        if (this.useCloud) {
            try {
                const photo = AV.Object.createWithoutData('Photo', id);
                await photo.destroy();
                return;
            } catch (error) {
                console.error('云端删除照片失败:', error);
                return this.deletePhotoLocal(id);
            }
        }
        return this.deletePhotoLocal(id);
    }

    async deletePhotoLocal(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.localDb.transaction([APP_CONFIG.photoStore], 'readwrite');
            const store = transaction.objectStore(APP_CONFIG.photoStore);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // 生成唯一ID
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
    }

    // 初始化应用
    async init() {
        this.showLoading();
        try {
            await this.db.init();
            this.updateConnectionStatus();
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

    // 更新连接状态显示
    updateConnectionStatus() {
        const statusEl = document.getElementById('connectionStatus');
        const dot = statusEl.querySelector('.status-dot');
        const text = statusEl.querySelector('.status-text');

        if (this.db.useCloud) {
            dot.classList.add('connected');
            dot.classList.remove('error');
            text.textContent = '云端已连接';
        } else {
            dot.classList.remove('connected');
            dot.classList.add('error');
            text.textContent = '本地模式';
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

    // 更新日期显示
    updateDateDisplay() {
        const now = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        document.getElementById('currentDate').textContent = now.toLocaleDateString('zh-CN', options);
    }

    // ========================================
    // 项目管理
    // ========================================

    // 加载项目列表
    async loadProjects() {
        try {
            this.allProjects = await this.db.getAllProjects();
            this.renderProjectList(this.allProjects);
        } catch (error) {
            console.error('加载项目失败:', error);
            this.showToast('加载项目失败', 'error');
        }
    }

    // 过滤项目
    filterProjects(keyword) {
        const filtered = this.allProjects.filter(p => 
            p.name.toLowerCase().includes(keyword.toLowerCase()) ||
            (p.address && p.address.toLowerCase().includes(keyword.toLowerCase()))
        );
        this.renderProjectList(filtered);
    }

    // 渲染项目列表
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
            const projectId = project.id || project.objectId;
            return `
                <div class="project-item ${this.currentProject?.id === projectId ? 'active' : ''}" 
                     data-id="${projectId}">
                    <div class="project-item-icon">🛗</div>
                    <div class="project-item-info">
                        <div class="project-item-name">${this.escapeHtml(project.name)}</div>
                        <div class="project-item-date">${this.formatDate(project.createdAt)}</div>
                        <div class="project-item-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progress}%"></div>
                            </div>
                            <span class="progress-text">${progress}%</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // 绑定项目点击事件
        container.querySelectorAll('.project-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                this.selectProject(id);
            });
        });
    }

    // 计算项目进度
    calculateProgress(project) {
        if (!project.steps) return 0;
        const completed = project.steps.filter(s => s.status === 'completed').length;
        return Math.round((completed / WORKFLOW_STEPS.length) * 100);
    }

    // 选择项目
    async selectProject(id) {
        try {
            const project = await this.db.getProject(id);
            if (!project) {
                this.showToast('项目不存在', 'error');
                return;
            }

            this.currentProject = project;
            this.currentProject.id = id;
            
            // 更新侧边栏选中状态
            document.querySelectorAll('.project-item').forEach(item => {
                item.classList.toggle('active', item.dataset.id === id);
            });

            // 显示项目详情
            document.getElementById('welcomePage').style.display = 'none';
            document.getElementById('projectDetail').style.display = 'block';
            
            await this.renderProjectDetail();
        } catch (error) {
            console.error('加载项目详情失败:', error);
            this.showToast('加载项目详情失败', 'error');
        }
    }

    // 渲染项目详情
    async renderProjectDetail() {
        const project = this.currentProject;
        const progress = this.calculateProgress(project);
        
        document.getElementById('projectTitle').textContent = project.name;
        document.getElementById('projectDate').textContent = `📅 创建于 ${this.formatDate(project.createdAt)}`;
        document.getElementById('projectAddress').textContent = project.address ? `📍 ${project.address}` : '';
        
        // 更新进度
        document.getElementById('progressFill').style.width = `${progress}%`;
        const completedCount = project.steps ? project.steps.filter(s => s.status === 'completed').length : 0;
        document.getElementById('progressText').textContent = `${completedCount}/${WORKFLOW_STEPS.length} 步骤完成`;
        document.getElementById('progressPercent').textContent = `${progress}%`;

        // 更新状态徽章
        const badge = document.getElementById('projectBadge');
        if (progress === 100) {
            badge.textContent = '已完成';
            badge.className = 'project-badge completed';
        } else if (progress > 0) {
            badge.textContent = '进行中';
            badge.className = 'project-badge';
        } else {
            badge.textContent = '待开始';
            badge.className = 'project-badge';
        }

        // 获取项目所有照片
        const projectId = project.id || project.objectId;
        const allPhotos = await this.db.getPhotosByProject(projectId);

        // 渲染步骤
        const container = document.getElementById('stepsContainer');
        container.innerHTML = WORKFLOW_STEPS.map((step, index) => {
            const stepData = project.steps?.find(s => s.id === step.id) || { id: step.id, status: 'pending' };
            const photos = allPhotos.filter(p => p.stepId === step.id);
            const statusClass = stepData.status === 'completed' ? 'completed' : 
                               stepData.status === 'in-progress' ? 'in-progress' : '';
            
            return `
                <div class="step-card ${statusClass}" data-step-id="${step.id}">
                    <div class="step-header">
                        <div class="step-number">${stepData.status === 'completed' ? '✓' : index + 1}</div>
                        <div class="step-title">${step.title}</div>
                        <div class="step-status">
                            <div class="photo-count">
                                <span>📷</span>
                                <span>${photos.length}</span>
                            </div>
                            <select class="step-status-select" data-step-id="${step.id}">
                                <option value="pending" ${stepData.status === 'pending' ? 'selected' : ''}>待开始</option>
                                <option value="in-progress" ${stepData.status === 'in-progress' ? 'selected' : ''}>进行中</option>
                                <option value="completed" ${stepData.status === 'completed' ? 'selected' : ''}>已完成</option>
                            </select>
                        </div>
                    </div>
                    <div class="step-content">
                        <div class="step-description">${step.description}</div>
                        <div class="step-photos">
                            ${photos.slice(0, 5).map(photo => `
                                <img src="${photo.url || photo.data}" class="photo-thumb" data-photo-id="${photo.id || photo.objectId}" 
                                     onclick="app.openPreviewFromStep('${photo.id || photo.objectId}', ${step.id})">
                            `).join('')}
                            ${photos.length > 5 ? `<span style="color: var(--gray-500); align-self: center; font-size: 13px;">+${photos.length - 5} 更多</span>` : ''}
                        </div>
                        <button class="btn-upload-photo" onclick="app.openPhotoModal(${step.id})">
                            <span>📷</span> 管理照片
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // 绑定状态选择事件
        container.querySelectorAll('.step-status-select').forEach(select => {
            select.addEventListener('change', (e) => {
                e.stopPropagation();
                const stepId = parseInt(select.dataset.stepId);
                this.updateStepStatus(stepId, select.value);
            });
        });
    }

    // 更新步骤状态
    async updateStepStatus(stepId, status) {
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

    // 打开项目模态框
    openProjectModal(editProject = null) {
        this.editingProjectId = editProject?.id || editProject?.objectId || null;
        
        document.getElementById('modalTitle').textContent = editProject ? '编辑项目' : '新建项目';
        document.getElementById('projectName').value = editProject?.name || '';
        document.getElementById('projectAddress').value = editProject?.address || '';
        document.getElementById('projectType').value = editProject?.type || 'update';
        document.getElementById('elevatorCount').value = editProject?.elevatorCount || 1;
        document.getElementById('projectNote').value = editProject?.note || '';
        
        document.getElementById('projectModal').classList.add('active');
        document.getElementById('projectName').focus();
    }

    // 关闭项目模态框
    closeProjectModal() {
        document.getElementById('projectModal').classList.remove('active');
        this.editingProjectId = null;
    }

    // 保存项目
    async saveProject() {
        const name = document.getElementById('projectName').value.trim();
        const address = document.getElementById('projectAddress').value.trim();
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
                project.type = type;
                project.elevatorCount = elevatorCount;
                project.note = note;
                project.updatedAt = new Date().toISOString();
            } else {
                project = {
                    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                    name,
                    address,
                    type,
                    elevatorCount,
                    note,
                    steps: WORKFLOW_STEPS.map(s => ({ id: s.id, status: 'pending' })),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }

            const saved = await this.db.saveProject(project);
            this.closeProjectModal();
            await this.loadProjects();
            
            const projectId = saved.id || saved.objectId || project.id;
            if (!this.editingProjectId) {
                this.selectProject(projectId);
            } else {
                this.currentProject = saved;
                this.currentProject.id = projectId;
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

    // 编辑当前项目
    editCurrentProject() {
        if (this.currentProject) {
            this.openProjectModal(this.currentProject);
        }
    }

    // 删除当前项目
    deleteCurrentProject() {
        if (!this.currentProject) return;

        this.showConfirm(`确定要删除项目"${this.currentProject.name}"吗？\n此操作将删除所有相关照片，且不可恢复！`, async () => {
            this.showLoading();
            try {
                const projectId = this.currentProject.id || this.currentProject.objectId;
                await this.db.deleteProject(projectId);
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

    // 打开照片模态框
    async openPhotoModal(stepId) {
        this.currentStep = stepId;
        const step = WORKFLOW_STEPS.find(s => s.id === stepId);
        document.getElementById('photoModalTitle').textContent = `${step.title} - 照片管理`;
        
        await this.loadStepPhotos();
        document.getElementById('photoModal').classList.add('active');
    }

    // 关闭照片模态框
    closePhotoModal() {
        document.getElementById('photoModal').classList.remove('active');
        document.getElementById('uploadProgress').style.display = 'none';
        this.currentStep = null;
        if (this.currentProject) {
            this.renderProjectDetail();
        }
    }

    // 加载步骤照片
    async loadStepPhotos() {
        try {
            const projectId = this.currentProject.id || this.currentProject.objectId;
            const photos = await this.db.getPhotosByStep(projectId, this.currentStep);
            this.currentPhotos = photos;
            this.renderPhotoGallery(photos);
        } catch (error) {
            console.error('加载照片失败:', error);
            this.showToast('加载照片失败', 'error');
        }
    }

    // 渲染照片画廊
    renderPhotoGallery(photos) {
        const container = document.getElementById('photoGallery');
        
        if (photos.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无照片，请上传</p></div>';
            return;
        }

        container.innerHTML = photos.map((photo, index) => `
            <div class="gallery-item" onclick="app.openPreview(${index})">
                <img src="${photo.url || photo.data}" alt="照片">
                <button class="delete-btn" onclick="event.stopPropagation(); app.deletePhotoById('${photo.id || photo.objectId}')">&times;</button>
            </div>
        `).join('');
    }

    // 触发照片上传
    triggerPhotoUpload() {
        document.getElementById('photoInput').click();
    }

    // 处理照片文件
    async handlePhotoFiles(files) {
        if (!files || files.length === 0) return;

        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 10 * 1024 * 1024; // 10MB
        let uploadCount = 0;
        const totalFiles = files.length;

        document.getElementById('uploadProgress').style.display = 'block';

        const projectId = this.currentProject.id || this.currentProject.objectId;

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
                    projectId, 
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

    // 从步骤打开预览
    async openPreviewFromStep(photoId, stepId) {
        this.currentStep = stepId;
        const projectId = this.currentProject.id || this.currentProject.objectId;
        const photos = await this.db.getPhotosByStep(projectId, stepId);
        this.currentPhotos = photos;
        const index = photos.findIndex(p => (p.id || p.objectId) === photoId);
        if (index >= 0) {
            this.openPreview(index);
        }
    }

    // 打开预览
    openPreview(index) {
        this.currentPhotoIndex = index;
        this.updatePreviewImage();
        document.getElementById('previewModal').classList.add('active');
    }

    // 关闭预览
    closePreviewModal() {
        document.getElementById('previewModal').classList.remove('active');
    }

    // 更新预览图片
    updatePreviewImage() {
        const photo = this.currentPhotos[this.currentPhotoIndex];
        if (photo) {
            document.getElementById('previewImage').src = photo.url || photo.data;
            document.getElementById('previewInfo').textContent = 
                `${this.currentPhotoIndex + 1} / ${this.currentPhotos.length} - ${this.formatDate(photo.createdAt)}`;
        }
    }

    // 显示上一张
    showPrevPhoto() {
        if (this.currentPhotoIndex > 0) {
            this.currentPhotoIndex--;
            this.updatePreviewImage();
        }
    }

    // 显示下一张
    showNextPhoto() {
        if (this.currentPhotoIndex < this.currentPhotos.length - 1) {
            this.currentPhotoIndex++;
            this.updatePreviewImage();
        }
    }

    // 删除当前预览的照片
    deleteCurrentPhoto() {
        const photo = this.currentPhotos[this.currentPhotoIndex];
        if (photo) {
            this.deletePhotoById(photo.id || photo.objectId);
        }
    }

    // 根据ID删除照片
    async deletePhotoById(id) {
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

    // 格式化日期
    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 显示 Toast
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

    // 显示确认对话框
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

    // 关闭确认对话框
    closeConfirmModal() {
        document.getElementById('confirmModal').classList.remove('active');
    }

    // 关闭所有模态框
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
