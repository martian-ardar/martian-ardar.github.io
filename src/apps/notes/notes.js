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
      draggingNoteIdx: null,
      contextMenu: {
        show: false,
        x: 0,
        y: 0,
        noteIdx: null
      },
      showNoteApp: true, // 在独立页面中直接显示笔记应用
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
        ? 'https://47.97.60.69'
        : 'https://SERVER_IP';
    }
  },

  created() {
    // 从localStorage中获取后端类型
    const savedBackendType = localStorage.getItem('backendType');
    if (savedBackendType) {
      this.backendType = savedBackendType;
      console.log('从localStorage获取后端类型:', this.backendType);
    }

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

    // 监听来自父窗口的消息，用于环境类型更新
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'updateBackendType') {
        console.log('收到来自父窗口的环境更新:', event.data.backendType);

        // 更新环境类型并刷新数据
        if (this.backendType !== event.data.backendType) {
          this.setBackendType(event.data.backendType);
        }
      }
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
            onClick: () => {
              this.setBackendType('public');
              // 显示切换成功消息
              this.showBackendSwitchNotification('Public环境');
            }
          },
          {
            text: 'Internal环境',
            icon: 'internal-icon',
            selected: this.backendType === 'internal',
            onClick: () => {
              this.setBackendType('internal');
              // 显示切换成功消息
              this.showBackendSwitchNotification('Internal环境');
            }
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

      // 保存选择到localStorage
      localStorage.setItem('backendType', type);
      console.log('环境类型已保存到localStorage:', type);

      // 立即刷新数据
      this.notes = [];
      this.fetchNotes();
    },

    // 显示环境切换通知
    showBackendSwitchNotification(envName) {
      // 提示用户环境已切换
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
    },

    toggleNoteApp() {
      this.showNoteApp = !this.showNoteApp;

      // 如果在单独的笔记应用页面，处理关闭行为
      if (!this.showNoteApp && window.location.href.includes('/apps/notes/')) {
        window.location.href = '/';
      }
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
        const editingIdx = this.editingIdx; // 保存当前索引的副本，供异步回调使用

        // 先在UI中更新便签，实现乐观更新
        this.notes[editingIdx] = {
          id: note.id,
          text: this.inputText,
          x: this.inputPos.x,
          y: this.inputPos.y
        };

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
            // API请求成功，可以更新ID（如果服务器生成了新ID）
            // 使用保存的索引而不是this.editingIdx
            if (this.notes[editingIdx]) {
              this.notes[editingIdx].id = data.id || note.id;
            }
          })
          .catch(error => {
            console.error('更新便签失败:', error);
            alert('保存失败，请重试。');
          });
      } else {
        // 添加新便签

        // 先创建一个临时ID，用于乐观更新
        const tempId = 'temp_' + Date.now();

        // 先在UI中添加新便签，不等待API请求完成
        const newNote = {
          id: tempId,
          text: this.inputText,
          x: this.inputPos.x,
          y: this.inputPos.y
        };

        // 添加到列表中以立即显示
        this.notes.push(newNote);

        // 记住新笔记的索引位置和临时ID
        const noteIndex = this.notes.length - 1;

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
            // API请求成功，更新临时ID为服务器返回的真实ID
            // 由于索引可能已经改变，查找并更新具有相同临时ID的笔记
            const noteToUpdate = this.notes.find(note => note.id === tempId);
            if (noteToUpdate) {
              noteToUpdate.id = data.id;
            }
          })
          .catch(error => {
            console.error('添加便签失败:', error);
            alert('保存失败，请重试。');
            // 如果失败，可以考虑从列表中移除这条笔记
            // this.notes = this.notes.filter(note => note.id !== tempId);
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

    // 实现图片拖拽功能
    handleImageDragStart(idx, e) {
      console.log('开始拖拽图片:', idx);
      this.draggingImageIdx = idx;

      // 存储拖拽开始时的相对位置
      const img = e.target;
      const rect = img.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      // 将相对位置存储在dataTransfer中
      e.dataTransfer.setData('text/plain', JSON.stringify({
        noteIdx: idx,
        offsetX: offsetX,
        offsetY: offsetY
      }));

      // 设置拖拽效果
      e.dataTransfer.effectAllowed = 'move';
    },

    handleImageDragEnd(idx, e) {
      console.log('结束拖拽图片:', idx);
      this.draggingImageIdx = null;
    },

    handleNoteDrop(e) {
      e.preventDefault();

      // 先尝试获取内部拖拽数据，确定是否为内部拖拽操作
      let internalDragData = null;
      try {
        const dataStr = e.dataTransfer.getData('text/plain');
        if (dataStr) {
          internalDragData = JSON.parse(dataStr);
        }
      } catch (err) {
        console.log('不是内部拖拽数据');
      }

      // 如果是内部拖拽，根据类型选择对应的处理函数
      if (internalDragData && typeof internalDragData.noteIdx === 'number') {
        // 判断是文字笔记还是图片笔记
        if (internalDragData.isTextNote) {
          return this.handleInternalTextNoteDrop(e, internalDragData);
        } else {
          return this.handleInternalImageDrop(e, internalDragData);
        }
      }

      // 1. 处理拖拽本地文件（本地图片上传）
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        console.log('检测到拖拽本地图片文件');
        const file = e.dataTransfer.files[0];

        // 只处理图片文件
        if (!file.type.startsWith('image/')) {
          console.warn('拖拽的不是图片文件:', file.type);
          return;
        }

        // 计算放置位置
        const noteArea = this.$refs.noteArea;
        const rect = noteArea.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 上传图片文件
        const formData = new FormData();
        formData.append('image', file);
        formData.append('x', x);
        formData.append('y', y);

        // 支持两种API端点：/api/images 和 /api/upload
        const uploadUrl = this.backendUrl + '/api/images';
        console.log('上传图片到:', uploadUrl);

        fetch(uploadUrl, {
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
            console.log('上传拖拽图片成功:', data);
            // 添加到笔记列表
            const imgUrl = data.img.startsWith('http')
              ? data.img
              : this.backendUrl + data.img;

            const newImage = {
              id: data.id,
              type: 'image',
              img: imgUrl,
              x: data.x || x,
              y: data.y || y,
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
            img.onerror = () => {
              console.error('无法加载图片缩略图:', imgUrl);
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
            img.src = imgUrl;
          })
          .catch(error => {
            console.error('拖拽上传图片失败:', error);
            // 尝试使用备选API
            const backupUrl = this.backendUrl + '/api/upload';
            console.log('尝试备选上传端点:', backupUrl);

            const backupFormData = new FormData();
            backupFormData.append('file', file); // 使用不同的字段名
            backupFormData.append('x', x);
            backupFormData.append('y', y);

            fetch(backupUrl, {
              method: 'POST',
              body: backupFormData
            })
              .then(res => res.json())
              .then(data => {
                console.log('备选上传成功:', data);
                // 处理响应并添加到笔记列表
                const imgUrl = data.img.startsWith('http')
                  ? data.img
                  : this.backendUrl + data.img;

                const newImage = {
                  id: data.id,
                  type: 'image',
                  img: imgUrl,
                  x: data.x || x,
                  y: data.y || y,
                  thumb: null
                };

                this.notes.push(newImage);
                // 同样生成缩略图
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
              .catch(err => {
                console.error('两种上传方式均失败:', err);
              });
          });

        return;
      }

      console.warn('未知的拖拽类型');
    },

    hideDockMenu() {
      this.dockMenu.show = false;
    },

    // 显示大图
    showImage(imgSrc) {
      // 显示大图预览
      this.showImgSrc = imgSrc;
      this.showImg = true;

      console.log('正在预览大图:', imgSrc);

      // 预加载大图，确保加载完成后显示
      const img = new Image();
      img.onload = () => {
        // 图片已加载完成，可以在这里添加额外处理
        console.log('大图加载完成，尺寸:', img.width, 'x', img.height);
      };
      img.onerror = () => {
        console.error('大图加载失败:', imgSrc);
        // 失败时也显示错误提示
        alert('图片加载失败，请检查网络或重试');
        this.showImg = false;
      };
      img.src = imgSrc;
    },

    handleInternalImageDrop(e, data) {
      console.log('处理内部图片拖拽');
      const noteIdx = data.noteIdx;
      const offsetX = data.offsetX;
      const offsetY = data.offsetY;

      if (typeof noteIdx !== 'number' || !this.notes[noteIdx]) {
        console.warn('找不到对应的便签:', noteIdx);
        return;
      }

      const noteArea = this.$refs.noteArea;
      const rect = noteArea.getBoundingClientRect();

      // 计算新位置时考虑拖拽开始的偏移量
      const x = e.clientX - rect.left - offsetX;
      const y = e.clientY - rect.top - offsetY;

      // 更新笔记位置
      this.notes[noteIdx].x = x;
      this.notes[noteIdx].y = y;

      // 保存位置到服务器
      const note = this.notes[noteIdx];
      fetch(this.backendUrl + '/api/notes/' + note.id, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          x: x,
          y: y
        })
      })
      .then(response => {
        if (!response.ok) {
          return Promise.reject(`HTTP错误，状态: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('便签位置更新成功:', data);
      })
      .catch(error => {
        console.error('更新位置失败:', error);
      });
    },

    // 文字笔记拖拽功能
    handleTextNoteDragStart(idx, e) {
      console.log('开始拖拽文字笔记:', idx);
      this.draggingNoteIdx = idx;

      // 存储拖拽开始时的相对位置
      const noteElement = e.target;
      const rect = noteElement.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      // 将相对位置存储在dataTransfer中
      e.dataTransfer.setData('text/plain', JSON.stringify({
        noteIdx: idx,
        offsetX: offsetX,
        offsetY: offsetY,
        isTextNote: true // 标识这是文字笔记
      }));

      // 设置拖拽效果
      e.dataTransfer.effectAllowed = 'move';
    },

    handleTextNoteDragEnd(idx, e) {
      console.log('结束拖拽文字笔记:', idx);
      this.draggingNoteIdx = null;
    },

    handleInternalTextNoteDrop(e, data) {
      console.log('处理内部文字笔记拖拽');
      const noteIdx = data.noteIdx;
      const offsetX = data.offsetX;
      const offsetY = data.offsetY;

      if (typeof noteIdx !== 'number' || !this.notes[noteIdx]) {
        console.warn('找不到对应的文字笔记:', noteIdx);
        return;
      }

      const noteArea = this.$refs.noteArea;
      const rect = noteArea.getBoundingClientRect();

      // 计算新位置时考虑拖拽开始的偏移量
      const x = e.clientX - rect.left - offsetX;
      const y = e.clientY - rect.top - offsetY;

      // 更新笔记位置
      this.notes[noteIdx].x = x;
      this.notes[noteIdx].y = y;

      // 保存位置到服务器
      const note = this.notes[noteIdx];
      fetch(this.backendUrl + '/api/notes/' + note.id, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          x: x,
          y: y
        })
      })
      .then(response => {
        if (!response.ok) {
          return Promise.reject(`HTTP错误，状态: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('文字笔记位置更新成功:', data);
      })
      .catch(error => {
        console.error('更新位置失败:', error);
      });
    },
  }
}).mount('#app');