/**
 * 中达国通电梯更新 - 主应用程序
 * 支持 GitHub 云端数据同步、管理员权限控制
 */

// ========================================
// 配置和常量
// ========================================

const APP_CONFIG = {
    // GitHub 仓库配置 - 用于读取云端数据
    githubUser: 'WangQing-dot',
    githubRepo: 'elevator-update',
    dataFile: 'projects.json',
    
    // 管理员密码配置
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
// 数据管理类
// ========================================

class DataManager {
    constructor() {
        this.projects = [];
        this.lastSync = null;
    }

    // 从 GitHub 加载云端数据
    async loadFromCloud() {
        try {
            const url = `https://raw.githubusercontent.com/${APP_CONFIG.githubUser}/${APP_CONFIG.githubRepo}/main/${APP_CONFIG.dataFile}?t=${Date.now()}`;
            const response = await fetch(url);
            
            if (response.ok) {
                const data = await response.json();
                this.projects = data.projects || [];
                this.lastSync = new Date().toISOString();
                console.log('从云端加载数据成功，项目数:', this.projects.length);
                return true;
            } else if (response.status === 404) {
                // 文件不存在，使用空数据
                console.log('云端数据文件不存在，使用空数据');
                this.projects = [];
                return true;
            } else {
                throw new Error('加载失败: ' + response.status);
            }
        } catch (error) {
            console.error('从云端加载数据失败:', error);
            // 尝试从本地存储加载
            return this.loadFromLocal();
        }
    }

    // 从本地存储加载
    loadFromLocal() {
        try {
            const saved = localStorage.getItem('elevator_projects');
            if (saved) {
                const data = JSON.parse(saved);
                this.projects = data.projects || [];
                console.log('从本地加载数据，项目数:', this.projects.length);
            }
            return true;
        } catch (error) {
            console.error('从本地加载数据失败:', error);
            this.projects = [];
            return false;
        }
    }

    // 保存到本地存储
    saveToLocal() {
        try {
            const data = {
                projects: this.projects,
                lastModified: new Date().toISOString()
            };
            localStorage.setItem('elevator_projects', JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('保存到本地失败:', error);
            return false;
        }
    }

    // 生成云端同步数据
    generateSyncData() {
        return JSON.stringify({
            projects: this.projects,
            lastModified: new Date().toISOString(),
            version: '1.0'
        }, null, 2);
    }

    // 获取所有项目
    getAllProjects() {
        return this.projects.sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    }

    // 获取单个项目
    getProject(id) {
        return this.projects.find(p => p.id === id);
    }

    // 保存项目
    saveProject(project) {
        const index = this.projects.findIndex(p => p.id === project.id);
        if (index >= 0) {
            this.projects[index] = project;
        } else {
            this.projects.push(project);
        }
        this.saveToLocal();
        return project;
    }

    // 删除项目
    deleteProject(id) {
        this.projects = this.projects.filter(p => p.id !== id);
        this.saveToLocal();
    }

    // 生成 ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// ========================================
// 应用程序主类
// ========================================

class ElevatorUpdateApp {
    constructor() {
        this.db = new DataManager();
        this.currentProject = null;
        this.currentStep = null;
        this.currentPhotos = [];
        this.currentPhotoIndex = 0;
        this.editingProjectId = null;
        this.allProjects = [];
        this.isAdmin = false;
        this.currentAdmin = null;
    }

    // 初始化应用
    async init() {
        this.showLoading();
        try {
            // 先尝试从云端加载
            await this.db.loadFromCloud();
            
            this.checkAdminSession();
            this.updateAdminUI();
            this.bindEvents();
            this.updateDateDisplay();
            this.loadProjects();
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

        // 同步云端
        document.getElementById('btnSyncCloud').addEventListener('click', () => this.openSyncModal());
        document.getElementById('closeSyncModal').addEventListener('click', () => this.closeSyncModal());
        document.getElementById('cancelSyncModal').addEventListener('click', () => this.closeSyncModal());
        document.getElementById('copySyncData').addEventListener('click', () => this.copySyncData());

        // 刷新数据
        document.getElementById('btnRefreshData').addEventListener('click', () => this.refreshData());

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
        document.getElementById('btnAddPhotoUrl').addEventListener('click', () => this.addPhotoFromUrl());

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
            // 重新渲染当前页面
            if (this.currentProject) {
                this.renderProjectDetail();
            }
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
        // 重新渲染当前页面
        if (this.currentProject) {
            this.renderProjectDetail();
        }
    }

    // ========================================
    // 云端同步功能
    // ========================================

    openSyncModal() {
        const syncData = this.db.generateSyncData();
        document.getElementById('syncDataText').value = syncData;
        document.getElementById('syncModal').classList.add('active');
    }

    closeSyncModal() {
        document.getElementById('syncModal').classList.remove('active');
    }

    copySyncData() {
        const textarea = document.getElementById('syncDataText');
        textarea.select();
        document.execCommand('copy');
        this.showToast('数据已复制到剪贴板！请去 GitHub 更新 projects.json 文件', 'success');
    }

    async refreshData() {
        this.showLoading();
        try {
            await this.db.loadFromCloud();
            this.loadProjects();
            if (this.currentProject) {
                const updated = this.db.getProject(this.currentProject.id);
                if (updated) {
                    this.currentProject = updated;
                    this.renderProjectDetail();
                }
            }
            this.showToast('数据已刷新', 'success');
        } catch (error) {
            this.showToast('刷新失败', 'error');
        } finally {
            this.hideLoading();
        }
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
        
        if (this.currentProject && this.currentProject.coords) {
            const coords = this.currentProject.coords.split(',');
            if (coords.length === 2) {
                const lng = parseFloat(coords[0]);
                const lat = parseFloat(coords[1]);
                
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

    loadProjects() {
        this.allProjects = this.db.getAllProjects();
        this.renderProjectList(this.allProjects);
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

    selectProject(id) {
        const project = this.db.getProject(id);
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
        
        this.renderProjectDetail();
    }

    renderProjectDetail() {
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

        // 渲染步骤
        const container = document.getElementById('stepsContainer');
        container.innerHTML = WORKFLOW_STEPS.map((step, index) => {
            const stepData = project.steps?.find(s => s.id === step.id) || { id: step.id, status: 'pending', photos: [] };
            const photos = stepData.photos || [];
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
                                    <img src="${photo.url}" class="photo-thumb" 
                                         onclick="app.openPreviewFromStep('${photo.id}', ${step.id})"
                                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><rect fill=%22%23ddd%22 width=%2260%22 height=%2260%22/><text x=%2230%22 y=%2235%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2212%22>图片</text></svg>'">
                                    <span class="photo-time">${this.formatDateTime(photo.uploadTime)}</span>
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

    updateStepStatus(stepId, status) {
        if (!this.isAdmin) {
            this.showToast('需要管理员权限', 'error');
            return;
        }

        if (!this.currentProject.steps) {
            this.currentProject.steps = WORKFLOW_STEPS.map(s => ({ id: s.id, status: 'pending', photos: [] }));
        }

        const step = this.currentProject.steps.find(s => s.id === stepId);
        if (step) {
            step.status = status;
        } else {
            this.currentProject.steps.push({ id: stepId, status, photos: [] });
        }

        this.currentProject.updatedAt = new Date().toISOString();
        this.db.saveProject(this.currentProject);
        this.loadProjects();
        this.renderProjectDetail();
        this.showToast('状态已更新（请记得同步到云端）', 'success');
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

    saveProject() {
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

        let project;
        if (this.editingProjectId) {
            project = this.db.getProject(this.editingProjectId);
            project.name = name;
            project.address = address;
            project.coords = coords;
            project.type = type;
            project.elevatorCount = elevatorCount;
            project.note = note;
            project.updatedAt = new Date().toISOString();
        } else {
            project = {
                id: this.db.generateId(),
                name,
                address,
                coords,
                type,
                elevatorCount,
                note,
                steps: WORKFLOW_STEPS.map(s => ({ id: s.id, status: 'pending', photos: [] })),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }

        this.db.saveProject(project);
        this.closeProjectModal();
        this.loadProjects();
        
        if (!this.editingProjectId) {
            this.selectProject(project.id);
        } else {
            this.currentProject = project;
            this.renderProjectDetail();
        }
        
        this.showToast(this.editingProjectId ? '项目已更新（请记得同步到云端）' : '项目创建成功（请记得同步到云端）', 'success');
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

        this.showConfirm(`确定要删除项目"${this.currentProject.name}"吗？\n此操作不可恢复！`, () => {
            this.db.deleteProject(this.currentProject.id);
            this.currentProject = null;
            
            document.getElementById('welcomePage').style.display = 'flex';
            document.getElementById('projectDetail').style.display = 'none';
            
            this.loadProjects();
            this.showToast('项目已删除（请记得同步到云端）', 'success');
        });
    }

    // ========================================
    // 照片管理
    // ========================================

    openPhotoModal(stepId) {
        this.currentStep = stepId;
        const step = WORKFLOW_STEPS.find(s => s.id === stepId);
        document.getElementById('photoModalTitle').textContent = `${step.title} - ${this.isAdmin ? '照片管理' : '查看照片'}`;
        
        this.loadStepPhotos();
        document.getElementById('photoModal').classList.add('active');
    }

    closePhotoModal() {
        document.getElementById('photoModal').classList.remove('active');
        this.currentStep = null;
        document.getElementById('photoUrlInput').value = '';
        if (this.currentProject) {
            this.renderProjectDetail();
        }
    }

    loadStepPhotos() {
        const stepData = this.currentProject.steps?.find(s => s.id === this.currentStep);
        const photos = stepData?.photos || [];
        this.currentPhotos = photos;
        this.renderPhotoGallery(photos);
    }

    renderPhotoGallery(photos) {
        const container = document.getElementById('photoGallery');
        
        if (photos.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无照片</p></div>';
            return;
        }

        container.innerHTML = photos.map((photo, index) => `
            <div class="gallery-item" onclick="app.openPreview(${index})">
                <img src="${photo.url}" alt="照片" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23ddd%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2214%22>图片加载失败</text></svg>'">
                <div class="photo-upload-time">📅 ${this.formatDateTime(photo.uploadTime)}</div>
                ${this.isAdmin ? `<button class="delete-btn" onclick="event.stopPropagation(); app.deletePhotoById('${photo.id}')">&times;</button>` : ''}
            </div>
        `).join('');
    }

    addPhotoFromUrl() {
        if (!this.isAdmin) {
            this.showToast('需要管理员权限', 'error');
            return;
        }

        const url = document.getElementById('photoUrlInput').value.trim();
        if (!url) {
            this.showToast('请输入图片链接', 'error');
            return;
        }

        if (!url.startsWith('http')) {
            this.showToast('请输入有效的图片链接', 'error');
            return;
        }

        // 找到当前步骤
        if (!this.currentProject.steps) {
            this.currentProject.steps = WORKFLOW_STEPS.map(s => ({ id: s.id, status: 'pending', photos: [] }));
        }

        let stepData = this.currentProject.steps.find(s => s.id === this.currentStep);
        if (!stepData) {
            stepData = { id: this.currentStep, status: 'pending', photos: [] };
            this.currentProject.steps.push(stepData);
        }

        if (!stepData.photos) {
            stepData.photos = [];
        }

        // 添加照片
        const photo = {
            id: this.db.generateId(),
            url: url,
            uploadTime: new Date().toISOString()
        };
        stepData.photos.push(photo);

        this.currentProject.updatedAt = new Date().toISOString();
        this.db.saveProject(this.currentProject);
        
        document.getElementById('photoUrlInput').value = '';
        this.loadStepPhotos();
        this.showToast('照片已添加（请记得同步到云端）', 'success');
    }

    openPreviewFromStep(photoId, stepId) {
        this.currentStep = stepId;
        const stepData = this.currentProject.steps?.find(s => s.id === stepId);
        const photos = stepData?.photos || [];
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
            document.getElementById('previewImage').src = photo.url;
            document.getElementById('previewInfo').textContent = 
                `${this.currentPhotoIndex + 1} / ${this.currentPhotos.length} - 上传于 ${this.formatDateTime(photo.uploadTime)}`;
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

    deletePhotoById(id) {
        if (!this.isAdmin) {
            this.showToast('需要管理员权限', 'error');
            return;
        }

        this.showConfirm('确定要删除这张照片吗？', () => {
            const stepData = this.currentProject.steps?.find(s => s.id === this.currentStep);
            if (stepData && stepData.photos) {
                stepData.photos = stepData.photos.filter(p => p.id !== id);
                this.currentProject.updatedAt = new Date().toISOString();
                this.db.saveProject(this.currentProject);
                this.showToast('照片已删除（请记得同步到云端）', 'success');
                
                this.loadStepPhotos();
                
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
