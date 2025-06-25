const { createApp } = Vue;

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
    menu.className = 'context-menu dock-context-menu';
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
    
    console.log('[ContextMenu] 菜单已创建:', options);
    return this.activeMenu;
  },
  
  close() {
    if (this.activeMenu) {
      document.removeEventListener('click', this.activeMenu.clickHandler);
      document.body.removeChild(this.activeMenu.element);
      this.activeMenu = null;
      console.log('[ContextMenu] 菜单已关闭');
    }
  }
};

// 主Vue应用
createApp({
  data() {
    return {
      notes: [],
      inputing: false,
      inputText: '',
      inputPos: { x: 0, y: 0 },
      editingIdx: null,
      backendType: 'public', // 默认Public
      showImg: false,
      showImgSrc: '',
      draggingImageIdx: null,
      contextMenu: {
        show: false,
        x: 0,
        y: 0,
        noteIdx: null
      },
      showNoteApp: false,
      expandedNoteApp: false,
      dockMenu: {
        show: false,
        x: 0,
        y: 0
      }
    };
  },
  
  computed: {
    backendUrl() {
      return this.backendType === 'public'
        ? 'http://47.97.60.69'
        : 'http://10.101.54.21';
    }
  },
  
  created() {
    // 页面加载时获取所有便签
    this.fetchNotes();
  },
  
  mounted() {
    // 点击页面其他地方关闭右键菜单
    document.addEventListener('click', this.hideContextMenu);
    
    // 注册全局右键菜单处理
    document.addEventListener('contextmenu', (e) => {
      // 检查是否在 dock 区域
      const dock = document.querySelector('.mac-dock');
      if (dock && dock.contains(e.target)) {
        // 不处理dock区域的右键菜单
        return;
      }
      
      // 关闭菜单
      ContextMenuManager.close();
    });
  },
  
  unmounted() {
    document.removeEventListener('click', this.hideContextMenu);
    ContextMenuManager.close();
  },
  
  methods: {
    fetchNotes() {
      fetch(this.backendUrl + '/api/notes')
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          console.log('获取到的笔记数据:', data);
          this.notes = data.map(item => {
            if (item.img) {
              // 是图片类型，生成缩略图thumb
              const imgUrl = item.img.startsWith('http') 
                ? item.img 
                : this.backendUrl + item.img;
              return { ...item, type: 'image', img: imgUrl, thumb: null };
            } else {
              // 文本类型
              return {
                id: item.id,
                text: item.text,
                x: item.x,
                y: item.y
              };
            }
          });
          
          // 生成图片缩略图
          this.notes.forEach((note, idx) => {
            if (note.type === 'image') {
              const img = new window.Image();
              img.crossOrigin = 'Anonymous'; // 解决跨域问题
              img.onload = () => {
                const max = 150;
                let w = img.width, h = img.height;
                if (w > h && w > max) { h = h * max / w; w = max; }
                else if (h > w && h > max) { w = w * max / h; h = max; }
                else if (w > max) { w = h = max; }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                this.notes[idx].thumb = canvas.toDataURL('image/png');
                this.$forceUpdate();
              };
              img.onerror = () => {
                console.error('无法加载图片:', note.img);
                // 创建一个简单的默认缩略图
                const canvas = document.createElement('canvas');
                canvas.width = 150; canvas.height = 150;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#f0f0f0';
                ctx.fillRect(0, 0, 150, 150);
                ctx.fillStyle = '#999';
                ctx.font = '24px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('图片加载失败', 75, 75);
                this.notes[idx].thumb = canvas.toDataURL('image/png');
                this.$forceUpdate();
              };
              img.src = note.img;
            }
          });
        });
    },
    
    hideContextMenu() {
      this.contextMenu.show = false;
    },
    
    showContextMenu(idx, e) {
      this.contextMenu.noteIdx = idx;
      this.contextMenu.x = e.clientX;
      this.contextMenu.y = e.clientY;
      this.contextMenu.show = true;
    },
    
    deleteNote() {
      const idx = this.contextMenu.noteIdx;
      if (idx !== null && this.notes[idx]) {
        const note = this.notes[idx];
        
        // 发送删除请求到服务器
        fetch(this.backendUrl + '/api/notes/' + note.id, {
          method: 'DELETE'
        })
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP error! Status: ${res.status}`);
            }
            return res.json();
          })
          .then(() => {
            // 从本地删除
            this.notes.splice(idx, 1);
            this.contextMenu.show = false;
          })
          .catch(error => {
            console.error('删除笔记失败:', error);
            alert('删除失败，请重试。');
            this.contextMenu.show = false;
          });
      }
    },
    
    // Dock相关方法
    showDockMenu(e) {
      console.log('[dock] 右键事件触发', e);
      e.preventDefault();
      e.stopPropagation();
      
      // 使用全局菜单管理器创建菜单
      ContextMenuManager.create({
        x: e.clientX,
        y: e.clientY - 10,
        items: [
          {
            text: 'Public环境',
            icon: 'public-icon',
            selected: this.backendType === 'public',
            onClick: () => this.setBackendType('public')
          },
          {
            text: 'Internal环境',
            icon: 'internal-icon',
            selected: this.backendType === 'internal',
            onClick: () => this.setBackendType('internal')
          }
        ]
      });
    },
    
    setBackendType(type) {
      // 如果已经是当前环境，不做任何改变
      if (this.backendType === type) {
        return;
      }
      
      // 切换环境
      this.backendType = type;
      
      // 提示用户环境已切换
      const envName = type === 'public' ? 'Public环境' : 'Internal环境';
      const notification = document.createElement('div');
      notification.textContent = `已切换到${envName}`;
      notification.style.cssText = `
        position: fixed;
        bottom: 60px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        z-index: 10000;
        font-size: 14px;
      `;
      document.body.appendChild(notification);
      
      // 2秒后移除通知
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s';
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 500);
      }, 2000);
      
      // 刷新数据
      this.notes = [];
      this.fetchNotes();
    },
    
    toggleNoteApp() {
      this.showNoteApp = !this.showNoteApp;
    },
    
    handleAreaClick(e) {
      if (this.inputing) return;
      const noteArea = e.currentTarget;
      const rect = noteArea.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      this.inputPos = { x, y };
      this.inputing = true;
      this.editingIdx = null;
      
      this.$nextTick(() => {
        const inputEl = this.$refs.inputBox;
        if (inputEl) {
          inputEl.focus();
        }
      });
    },
    
    editNote(idx, e) {
      const note = this.notes[idx];
      if (!note || note.type === 'image') return;
      
      this.inputPos = { x: note.x, y: note.y };
      this.inputText = note.text;
      this.inputing = true;
      this.editingIdx = idx;
      
      this.$nextTick(() => {
        const inputEl = this.$refs.inputBox;
        if (inputEl) {
          inputEl.focus();
          inputEl.select();
        }
      });
    },
    
    saveInput() {
      if (!this.inputText.trim()) {
        this.inputing = false;
        this.inputText = '';
        this.editingIdx = null;
        return;
      }
      
      if (this.editingIdx !== null) {
        // 编辑已有便签
        const note = this.notes[this.editingIdx];
        
        fetch(this.backendUrl + '/api/notes/' + note.id, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: this.inputText,
            x: this.inputPos.x,
            y: this.inputPos.y
          })
        })
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP error! Status: ${res.status}`);
            }
            return res.json();
          })
          .then(data => {
            this.notes[this.editingIdx] = {
              id: data.id || note.id,
              text: this.inputText,
              x: this.inputPos.x,
              y: this.inputPos.y
            };
          })
          .catch(error => {
            console.error('更新便签失败:', error);
            alert('保存失败，请重试。');
          });
      } else {
        // 添加新便签
        fetch(this.backendUrl + '/api/notes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: this.inputText,
            x: this.inputPos.x,
            y: this.inputPos.y
          })
        })
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP error! Status: ${res.status}`);
            }
            return res.json();
          })
          .then(data => {
            this.notes.push({
              id: data.id,
              text: this.inputText,
              x: this.inputPos.x,
              y: this.inputPos.y
            });
          })
          .catch(error => {
            console.error('添加便签失败:', error);
            alert('保存失败，请重试。');
          });
      }
      
      this.inputing = false;
      this.inputText = '';
      this.editingIdx = null;
    },
    
    handleImageUpload(e) {
      const file = e.target.files[0];
      if (!file) return;
      
      const formData = new FormData();
      formData.append('image', file);
      formData.append('x', 50); // 默认位置
      formData.append('y', 50);
      
      fetch(this.backendUrl + '/api/images', {
        method: 'POST',
        body: formData
      })
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          // 添加到笔记列表
          const imgUrl = data.img.startsWith('http')
            ? data.img
            : this.backendUrl + data.img;
          
          const newImage = {
            id: data.id,
            type: 'image',
            img: imgUrl,
            x: data.x || 50,
            y: data.y || 50,
            thumb: null
          };
          
          this.notes.push(newImage);
          
          // 生成缩略图
          const idx = this.notes.length - 1;
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = () => {
            const max = 150;
            let w = img.width, h = img.height;
            if (w > h && w > max) { h = h * max / w; w = max; }
            else if (h > w && h > max) { w = w * max / h; h = max; }
            else if (w > max) { w = h = max; }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            this.notes[idx].thumb = canvas.toDataURL('image/png');
            this.$forceUpdate();
          };
          img.src = imgUrl;
        })
        .catch(error => {
          console.error('上传图片失败:', error);
          alert('上传失败，请重试。');
        });
      
      // 清空input，允许重复上传同一文件
      e.target.value = '';
    },
    
    startDragging(idx, e) {
      // 只允许左键拖拽
      if (e.button !== 0) return;
      
      this.draggingImageIdx = idx;
      e.preventDefault();
      
      const note = this.notes[idx];
      if (!note) return;
      
      const moveHandler = (moveEvent) => {
        if (this.draggingImageIdx === null) return;
        
        const noteArea = document.querySelector('.note-area');
        const rect = noteArea.getBoundingClientRect();
        const x = moveEvent.clientX - rect.left;
        const y = moveEvent.clientY - rect.top;
        
        // 更新位置
        this.notes[this.draggingImageIdx].x = x;
        this.notes[this.draggingImageIdx].y = y;
      };
      
      const upHandler = () => {
        if (this.draggingImageIdx === null) return;
        
        const note = this.notes[this.draggingImageIdx];
        if (!note) return;
        
        // 保存位置到服务器
        fetch(this.backendUrl + '/api/notes/' + note.id, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            x: note.x,
            y: note.y
          })
        })
          .catch(error => {
            console.error('更新位置失败:', error);
          });
        
        this.draggingImageIdx = null;
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', upHandler);
      };
      
      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('mouseup', upHandler);
    },
    
    showBigImage(idx) {
      const note = this.notes[idx];
      if (!note || note.type !== 'image') return;
      
      this.showImgSrc = note.img;
      this.showImg = true;
    },
    
    hideDockMenu() {
      this.dockMenu.show = false;
    }
  }
}).mount('#app');