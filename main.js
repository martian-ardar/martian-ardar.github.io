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

// 主页Vue应用
createApp({
  data() {
    return {
      backendType: localStorage.getItem('backendType') || 'public', // 从本地存储获取，默认Public
      showNoteApp: false // 默认不显示笔记应用
    };
  },
  
  mounted() {
    // 初始化时确保应用窗口是关闭的
    const noteAppModal = document.getElementById('noteAppModal');
    const modalMask = document.getElementById('modalMask');
    if (noteAppModal) noteAppModal.style.display = 'none';
    if (modalMask) modalMask.style.display = 'none';
    
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
    // 打开笔记应用
    openNoteApp() {
      this.showNoteApp = true;
      
      // 显示应用窗口
      const noteAppModal = document.getElementById('noteAppModal');
      const modalMask = document.getElementById('modalMask');
      if (noteAppModal) noteAppModal.style.display = 'flex';
      if (modalMask) modalMask.style.display = 'block';
      
      // 加载笔记应用的内容到iframe
      const iframe = document.getElementById('notesIframe');
      if (iframe) {
        // 如果iframe还未加载或需要重新加载
        if (!iframe.getAttribute('src') || iframe.getAttribute('src') === '') {
          iframe.setAttribute('src', 'apps/notes/index.html');
        }
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
      if (noteAppModal) noteAppModal.style.display = 'none';
      if (modalMask) modalMask.style.display = 'none';
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

