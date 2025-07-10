const { createApp, nextTick } = Vue;

// 创建全局菜单管理器
const ContextMenuManager = {
  activeMenu: null,
  
  create(options) {
    // 如果已有菜单，则先关闭
    if (this.activeMenu) {
      this.close();
    }
    
    // 创建菜单容器
    const container = document.createElement('div');
    container.className = 'global-context-menu-container';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 20000;
      pointer-events: none;
    `;
    
    // 创建菜单元素
    const menu = document.createElement('div');
    menu.className = 'dock-context-menu';
    menu.style.cssText = `
      position: absolute;
      left: ${options.x}px;
      top: ${options.y}px;
      pointer-events: auto;
      background: rgba(255,255,255,0.95);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(0,0,0,0.1);
      min-width: 160px;
      box-shadow: 0 6px 16px rgba(0,0,0,0.15);
      border-radius: 8px;
      padding: 5px 0;
      z-index: 9999;
      animation: fadeIn 0.15s ease-out;
    `;
    
    // 添加菜单选项
    options.items.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.className = 'context-menu-item';
      if (item.selected) {
        menuItem.classList.add('selected');
      }
      
      // 创建图标
      if (item.icon) {
        const icon = document.createElement('i');
        icon.className = `menu-icon ${item.icon}`;
        menuItem.appendChild(icon);
      }
      
      // 添加文本
      const text = document.createTextNode(item.text);
      menuItem.appendChild(text);
      
      // 添加点击事件
      menuItem.addEventListener('click', () => {
        if (typeof item.onClick === 'function') {
          item.onClick();
        }
        this.close();
      });
      
      menu.appendChild(menuItem);
    });
    
    // 将菜单添加到容器
    container.appendChild(menu);
    document.body.appendChild(container);
    
    // 调整菜单位置，确保在视口内
    const rect = menu.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;
    
    if (rect.right > winWidth) {
      menu.style.left = (winWidth - rect.width - 10) + 'px';
    }
    
    if (rect.bottom > winHeight) {
      menu.style.top = (winHeight - rect.height - 10) + 'px';
    }
    
    // 添加全局点击事件，关闭菜单
    const clickHandler = (e) => {
      if (!menu.contains(e.target)) {
        this.close();
      }
    };
    
    // 延迟添加点击事件，避免立即触发
    setTimeout(() => {
      document.addEventListener('click', clickHandler);
    }, 10);
    
    this.activeMenu = {
      element: container,
      clickHandler
    };
    
    return this.activeMenu;
  },
  
  close() {
    if (this.activeMenu) {
      document.removeEventListener('click', this.activeMenu.clickHandler);
      document.body.removeChild(this.activeMenu.element);
      this.activeMenu = null;
    }
  }
};

// 添加登录凭证验证
const authManager = {
  // 验证凭证 - 通过API调用
  async validateCredentials(username, password) {
    // 获取当前环境设置
    const backendType = localStorage.getItem('backendType') || 'internal';
    
    // 尝试使用当前环境
    const result = await this.tryLogin(username, password, backendType);
    
    // 如果当前环境失败，尝试另一个环境
    if (!result.success) {
      const alternativeType = backendType === 'public' ? 'internal' : 'public';
      console.log(`当前环境(${backendType})登录失败，尝试使用${alternativeType}环境...`);
      return await this.tryLogin(username, password, alternativeType);
    }
    
    return result;
  },
  
  // 尝试使用指定环境进行登录
  async tryLogin(username, password, backendType) {
    try {
      const apiBaseUrl = backendType === 'public'
        ? 'https://47.97.60.69' // 公网环境
        : 'https://SERVER_IP'; // 内网环境
      
      // 发送请求到后端
      console.log(`正在连接到: ${apiBaseUrl}/api/auth/login`); // 添加日志
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      
      // 检查响应状态
      if (!response.ok) {
        console.error(`服务器返回错误状态码: ${response.status}`);
        // 尝试获取错误文本
        const errorText = await response.text();
        console.log('服务器响应内容:', errorText);
        return { success: false, message: `服务器错误: ${response.status}`, backendType };
      }
      
      const data = await response.json();
      if (data.success) {
        // 如果登录成功，记住这个成功的环境
        localStorage.setItem('backendType', backendType);
      }
      return { 
        success: data.success,
        message: data.message,
        backendType
      };
    } catch (error) {
      console.error(`在${backendType}环境下登录验证失败:`, error);
      return { success: false, message: '网络错误，请稍后再试', backendType };
    }
  },
  
  // 登录 - 异步方法
  async login(username, password) {
    const result = await this.validateCredentials(username, password);
    if (result.success) {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('username', username);
      // 在成功登录后，更新应用的后端环境设置
      if (result.backendType) {
        localStorage.setItem('backendType', result.backendType);
      }
      return true;
    }
    return false;
  },
  
  // 退出
  logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
  },
  
  // 检查登录状态
  checkLoginStatus() {
    return {
      isLoggedIn: localStorage.getItem('isLoggedIn') === 'true',
      username: localStorage.getItem('username')
    };
  }
};

// 主页Vue应用
createApp({
  data() {
    const loginStatus = authManager.checkLoginStatus();
    return {
      backendType: localStorage.getItem('backendType') || 'internal', // 从本地存储获取，默认为internal
      showNoteApp: false, // 默认不显示笔记应用
      isLoggedIn: loginStatus.isLoggedIn,
      username: loginStatus.username,
      showLoginForm: false,
      loginUsername: '',
      loginPassword: '',
      loginError: ''
    };
  },
  
  mounted() {
    // 初始化时确保应用窗口是关闭的
    const noteAppModal = document.getElementById('noteAppModal');
    const modalMask = document.getElementById('modalMask');
    if (noteAppModal) {
      noteAppModal.classList.add('hidden');
      noteAppModal.style.display = 'none';
    }
    if (modalMask) {
      modalMask.classList.add('hidden');
      modalMask.style.display = 'none';
    }
    
    // 注册全局右键菜单处理
    document.addEventListener('contextmenu', (e) => {
      // 关闭任何已打开的菜单
      ContextMenuManager.close();
    });
    
    // 特别注册Dock栏的右键事件
    const dockApp = document.querySelector('.dock-app');
    if (dockApp) {
      dockApp.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showDockMenu(e);
      });
    }
  },
  
  unmounted() {
    ContextMenuManager.close();
  },
  
  methods: {
    // 登录方法 - 异步
    async login() {
      if (!this.loginUsername || !this.loginPassword) {
        this.loginError = '请输入用户名和密码';
        return;
      }
      
      // 显示加载状态
      this.loginError = '登录中...';
      
      try {
        const success = await authManager.login(this.loginUsername, this.loginPassword);
        if (success) {
          this.isLoggedIn = true;
          this.username = this.loginUsername;
          this.showLoginForm = false;
          this.loginError = '';
          this.loginUsername = '';
          this.loginPassword = '';
          
          // 通知iframe内的笔记应用更新登录状态
          this.notifyLoginStatusToNotes();
        } else {
          this.loginError = '用户名或密码错误';
        }
      } catch (error) {
        console.error('登录过程发生错误:', error);
        this.loginError = '登录失败，请稍后再试';
      }
    },
    
    // 退出登录
    logout() {
      authManager.logout();
      this.isLoggedIn = false;
      this.username = '';
      
      // 通知iframe内的笔记应用更新登录状态
      this.notifyLoginStatusToNotes();
    },
    
    // 通知笔记应用登录状态
    notifyLoginStatusToNotes() {
      const iframe = document.getElementById('notesIframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'updateLoginStatus',
          isLoggedIn: this.isLoggedIn,
          username: this.username
        }, '*');
      }
    },
    
    // 切换笔记应用状态（打开或关闭）
    toggleNoteApp() {
      // 如果应用已经打开，则关闭它
      if (this.showNoteApp) {
        this.closeNoteApp();
        return;
      }
      
      // 否则打开应用
      this.showNoteApp = true;
      
      // 显示应用窗口
      const noteAppModal = document.getElementById('noteAppModal');
      const modalMask = document.getElementById('modalMask');
      if (noteAppModal) {
        noteAppModal.classList.remove('hidden');
        noteAppModal.style.display = 'flex';
      }
      if (modalMask) {
        modalMask.classList.remove('hidden');
        modalMask.style.display = 'block';
      }
      
      // 加载笔记应用的内容到iframe
      const iframe = document.getElementById('notesIframe');
      if (iframe) {
        // 如果iframe还未加载或需要重新加载
        if (!iframe.getAttribute('src') || iframe.getAttribute('src') === '') {
          iframe.setAttribute('src', 'src/apps/notes/index.html');
        }
        
        // 当iframe加载完成后，发送登录状态信息
        iframe.onload = () => {
          this.notifyLoginStatusToNotes();
        };
      } else {
        console.error('找不到笔记应用iframe元素');
      }
    },
    
    // 关闭笔记应用
    closeNoteApp() {
      this.showNoteApp = false;
      
      // 隐藏应用窗口
      const noteAppModal = document.getElementById('noteAppModal');
      const modalMask = document.getElementById('modalMask');
      if (noteAppModal) {
        noteAppModal.classList.add('hidden');
        noteAppModal.style.display = 'none';
      }
      if (modalMask) {
        modalMask.classList.add('hidden');
        modalMask.style.display = 'none';
      }
    },
    
    // 显示Dock菜单
    showDockMenu(event) {
      event.preventDefault();
      event.stopPropagation();
      console.log('右键菜单触发', event.clientX, event.clientY);
      
      // 更新调试信息
      const debugElement = document.getElementById('rightClickStatus');
      if (debugElement) {
        debugElement.textContent = '已触发 - X:' + event.clientX + ', Y:' + event.clientY;
      }
      
      // 创建右键菜单
      ContextMenuManager.create({
        x: event.clientX,
        y: event.clientY,
        items: [
          {
            text: '公网环境',
            icon: 'public-icon',
            selected: this.backendType === 'public',
            onClick: () => {
              this.backendType = 'public';
              localStorage.setItem('backendType', 'public');
              
              // 通知iframe内的笔记应用更新环境
              const iframe = document.getElementById('notesIframe');
              if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                  type: 'updateBackendType',
                  backendType: 'public'
                }, '*');
              }
            }
          },
          {
            text: '内网环境',
            icon: 'internal-icon',
            selected: this.backendType === 'internal',
            onClick: () => {
              this.backendType = 'internal';
              localStorage.setItem('backendType', 'internal');
              
              // 通知iframe内的笔记应用更新环境
              const iframe = document.getElementById('notesIframe');
              if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                  type: 'updateBackendType', 
                  backendType: 'internal'
                }, '*');
              }
            }
          }
        ]
      });
    }
  }
}).mount('#app');