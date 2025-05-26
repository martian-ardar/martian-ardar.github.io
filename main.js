const { createApp } = Vue;
createApp({  data() {
    return {
      notes: [],
      inputing: false,
      inputText: '',
      inputPos: { x: 0, y: 0 },
      editingIdx: null,
      backendType: 'public', // 新增，默认Public
      showImg: false,
      showImgSrc: '',
      draggingImageIdx: null, // 新增，记录当前拖拽的图片索引
      contextMenu: {
        show: false,
        x: 0,
        y: 0,
        noteIdx: null
      },
    }
  },
  computed: {
    backendUrl() {
      return this.backendType === 'public'
        ? 'http://47.97.60.69'
        : 'http://10.101.54.21';
    }
  },  created() {
    // 页面加载时获取所有便签
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
            // 确保img路径正确
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
  mounted() {
    // 点击页面其他地方关闭右键菜单    document.addEventListener('click', this.hideContextMenu);
    // 只拦截noteArea之外的右键点击，防止与笔记的右键菜单冲突
    document.addEventListener('contextmenu', (e) => {
      // 检查点击是否在noteArea外
      const noteArea = this.$refs.noteArea;
      if (noteArea && !noteArea.contains(e.target)) {
        this.hideContextMenu();
      }
    });
  },
  unmounted() {
    document.removeEventListener('click', this.hideContextMenu);
    document.removeEventListener('contextmenu', this.hideContextMenu);
  },
  watch: {
    backendType() {
      // 切换后端时重新拉取数据，并清空当前内容
      this.notes = [];
      this.inputing = false;
      this.inputText = '';
      this.editingIdx = null;      fetch(this.backendUrl + '/api/notes')
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          console.log('切换后端，获取到的笔记数据:', data);
          this.notes = data.map(item => {
            if (item.img) {
              // 是图片类型，确保img路径正确
              const imgUrl = item.img.startsWith('http') 
                ? item.img 
                : this.backendUrl + item.img;
              return { ...item, type: 'image', img: imgUrl, thumb: null };
            } else {
              return {
                id: item.id,
                text: item.text,
                x: item.x,
                y: item.y
              };
            }
          });// 生成图片缩略图
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
    }
  },
  methods: {
    handleAreaClick(e) {
      if (this.inputing) return;
      const rect = this.$refs.noteArea.getBoundingClientRect();
      this.inputPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      this.inputText = '';
      this.inputing = true;
      this.editingIdx = null;
      this.$nextTick(() => {
        this.$refs.inputBox && this.$refs.inputBox.focus();
      });
    },
    editNote(idx, e) {
      if (this.inputing) return;
      const item = this.notes[idx];
      this.inputPos = { x: item.x, y: item.y };
      this.inputText = item.text;
      this.inputing = true;
      this.editingIdx = idx;
      this.$nextTick(() => {
        this.$refs.inputBox && this.$refs.inputBox.focus();
      });
    },
    saveInput() {
      if (this.inputText.trim()) {
        if (this.editingIdx !== null) {
          // 编辑已有
          const note = this.notes[this.editingIdx];
          fetch(`${this.backendUrl}/api/notes/${note.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: this.inputText,
              x: note.x,
              y: note.y
            })
          })
            .then(res => res.json())
            .then(data => {
              // 用后端返回的内容更新前端
              this.notes[this.editingIdx].text = data.text;
              this.notes[this.editingIdx].x = data.x;
              this.notes[this.editingIdx].y = data.y;
              this.inputing = false;
              this.inputText = '';
              this.editingIdx = null;
            });
          return;
        } else {
          // 新增
          fetch(this.backendUrl + '/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: this.inputText,
              x: this.inputPos.x,
              y: this.inputPos.y
            })
          })
            .then(res => res.json())
            .then(data => {
              this.notes.push({
                id: data.id,
                text: data.text,
                x: data.x,
                y: data.y
              });
              this.inputing = false;
              this.inputText = '';
              this.editingIdx = null;
            });
          return;
        }
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
      // 上传到后端
      fetch(this.backendUrl + '/api/upload', {
        method: 'POST',
        body: formData
      })        .then(res => res.json())
        .then(data => {
          const imgUrl = this.backendUrl + data.url; // 完整URL
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
            const thumb = canvas.toDataURL('image/png');            // 新增：保存图片note到后端
            fetch(this.backendUrl + '/api/notes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                img: data.url, // 相对路径
                x: 20,
                y: 20
              })
            })
              .then(res => {
                if (!res.ok) {
                  throw new Error(`HTTP error! Status: ${res.status}`);
                }
                return res.json();
              })
              .then(noteData => {
                console.log('保存图片笔记成功:', noteData);
                // 确保缩略图已经正确生成
                const newNote = {
                  id: noteData.id,
                  type: 'image',
                  img: imgUrl,
                  thumb: thumb, // 确保thumb被设置
                  x: noteData.x || 20,
                  y: noteData.y || 20
                };
                this.notes.push(newNote);
                this.$forceUpdate(); // 强制更新视图
              })
              .catch(err => {
                console.error('保存图片笔记失败:', err);
                // 即使后端保存失败，也在前端显示
                const newNote = {
                  id: Date.now(), // 临时ID
                  type: 'image',
                  img: imgUrl,
                  thumb: thumb,
                  x: 20,
                  y: 20
                };
                this.notes.push(newNote);
                this.$forceUpdate();
              });
          };          img.onerror = () => {
            console.error('无法加载图片:', imgUrl);
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
            const errorThumb = canvas.toDataURL('image/png');
            
            // 即使无法加载原图，也添加笔记
            fetch(this.backendUrl + '/api/notes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                img: data.url,
                x: 20,
                y: 20
              })
            })
              .then(res => {
                if (!res.ok) {
                  throw new Error(`HTTP error! Status: ${res.status}`);
                }
                return res.json();
              })
              .then(noteData => {
                this.notes.push({
                  id: noteData.id,
                  type: 'image',
                  img: imgUrl,
                  thumb: errorThumb, // 使用错误缩略图
                  x: noteData.x || 20,
                  y: noteData.y || 20
                });
              })
              .catch(err => {
                console.error('保存图片笔记失败:', err);
                // 即使后端保存失败，也在前端显示
                this.notes.push({
                  id: Date.now(), // 临时ID
                  type: 'image',
                  img: imgUrl,
                  thumb: errorThumb,
                  x: 20,
                  y: 20
                });
              });
          };
          img.src = imgUrl;
        });
      // 清空input
      e.target.value = '';
    },
    showImage(src) {
      this.showImgSrc = src;
      this.showImg = true;
    },
    handleDropImage(e) {
      e.preventDefault();
      // 如果是图片内部拖拽，不处理（防止复制）
      if (e.dataTransfer.types && e.dataTransfer.types.includes('text/plain')) {
        const type = e.dataTransfer.getData('text/plain');
        if (type === 'image-move') return;
      }
      // 只处理文件拖拽
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        const rect = this.$refs.noteArea.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const formData = new FormData();
        formData.append('image', file);
        fetch(this.backendUrl + '/api/upload', {
          method: 'POST',
          body: formData
        })
          .then(res => res.json())
          .then(data => {            const imgUrl = this.backendUrl + data.url;
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
              const thumb = canvas.toDataURL('image/png');              // 新增：保存图片note到后端
              fetch(this.backendUrl + '/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  img: data.url, // 相对路径
                  x,
                  y
                })
              })
                .then(res => {
                  if (!res.ok) {
                    throw new Error(`HTTP error! Status: ${res.status}`);
                  }
                  return res.json();
                })
                .then(noteData => {
                  console.log('保存拖放图片笔记成功:', noteData);
                  const newNote = {
                    id: noteData.id,
                    type: 'image',
                    img: imgUrl,
                    thumb: thumb, // 确保缩略图被设置
                    x: noteData.x || x,
                    y: noteData.y || y
                  };
                  this.notes.push(newNote);
                  this.$forceUpdate(); // 强制更新视图
                })
                .catch(err => {
                  console.error('保存拖放图片笔记失败:', err);
                  // 即使后端保存失败，也在前端显示
                  const newNote = {
                    id: Date.now(), // 临时ID
                    type: 'image',
                    img: imgUrl,
                    thumb: thumb,
                    x: x,
                    y: y
                  };
                  this.notes.push(newNote);
                  this.$forceUpdate();
                });
            };
            img.src = imgUrl;
          });
      }
    },    handleImageDragStart(idx, e) {
      // 验证索引的有效性
      if (idx === undefined || idx === null || !this.notes[idx]) {
        console.error('无效的图片索引:', idx);
        e.preventDefault();
        return false;
      }
      
      this.draggingImageIdx = idx;
      
      // 设置拖拽类型，防止drop事件被触发
      e.dataTransfer.setData('text/plain', 'image-move');
      
      // 确保有缩略图才设置拖拽图像
      if (e.dataTransfer && this.notes[idx] && this.notes[idx].thumb) {
        const dragImg = new window.Image();
        dragImg.src = this.notes[idx].thumb;
        e.dataTransfer.setDragImage(dragImg, 75, 75);
      }
      
      e.dataTransfer.effectAllowed = 'move';
      
      // 添加日志，方便调试
      console.log('开始拖拽图片:', idx, this.notes[idx].id);
    },    handleImageDragEnd(idx, e) {
      // 只处理在note-area内松开
      const rect = this.$refs.noteArea.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom
      ) {
        const note = this.notes[idx];
        // 确保有效的note且有id
        if (!note || !note.id) {
          console.error('无效的笔记ID:', idx, note);
          this.draggingImageIdx = null;
          return;
        }
        
        // 立即更新前端显示，提高用户体验
        this.notes[idx].x = x;
        this.notes[idx].y = y;
        
        // 简化处理逻辑：仅发送x, y坐标
        console.log('拖拽更新图片位置:', {
          id: note.id,
          x,
          y
        });
          // 保存到后端
        // 检查是否是图片类型的笔记
        const isImage = note.type === 'image' || note.img;
        
        // 组装请求数据
        const updateData = {
          x,
          y
        };
        
        // 如果是图片类型，确保传递img字段
        // 注意：服务器端会处理，但我们仍然发送，以确保请求类型明确
        if (isImage && note.img) {
          // 提取相对路径
          let imgPath = '';
          try {
            if (note.img.startsWith('http')) {
              const url = new URL(note.img);
              imgPath = url.pathname; // 例如 /uploads/file.jpg
            } else if (note.img.startsWith('/')) {
              imgPath = note.img;
            } else {
              imgPath = note.img.replace(this.backendUrl, '');
            }
          } catch (e) {
            console.error('处理图片路径出错:', e);
            imgPath = note.img;
          }
          
          // 仅当确实有图片路径时才添加
          if (imgPath) {
            updateData.img = imgPath;
          }
        }
        
        console.log('发送更新请求:', updateData);
        
        fetch(`${this.backendUrl}/api/notes/${note.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        })
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP error! Status: ${res.status}`);
            }
            return res.json();
          })
          .then(data => {
            // 可以在这里处理后端返回的更新结果
            console.log('图片位置已更新', data);
          })
          .catch(err => {
            console.error('更新图片位置失败:', err);
          });
      }
      this.draggingImageIdx = null;
    },
    hideContextMenu() {
      this.contextMenu.show = false;
    },    showContextMenu(idx, e) {
      e.preventDefault();
      this.contextMenu.noteIdx = idx;
      this.contextMenu.x = e.clientX;
      this.contextMenu.y = e.clientY;
      this.contextMenu.show = true;
    },    deleteNote() {
      const idx = this.contextMenu.noteIdx;
      if (idx === null || idx === undefined) return;
      const note = this.notes[idx];
      if (!note || !note.id) return;
      
      // 显示确认操作
      if (confirm('确定要删除这条记录吗？')) {
        console.log('删除笔记:', note);
        
        // 调用删除接口
        fetch(`${this.backendUrl}/api/notes/${note.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        })
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP error! Status: ${res.status}`);
            }
            return res.json();
          })
          .then(data => {
            console.log('删除成功:', data);
            // 删除成功，更新前端状态
            this.notes.splice(idx, 1);
            this.contextMenu.show = false;
          })
          .catch(err => {
            console.error('删除笔记失败:', err);
            alert('删除失败，请稍后再试');
          });
      } else {
        // 用户取消删除
        this.contextMenu.show = false;
      }
    },
  }
}).mount('#app');