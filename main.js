const { createApp } = Vue;
createApp({
  data() {
    return {
      notes: [],
      inputing: false,
      inputText: '',
      inputPos: { x: 0, y: 0 },
      editingIdx: null,
      backendType: 'public', // 新增，默认Public
    }
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
    fetch(this.backendUrl + '/api/notes')
      .then(res => res.json())
      .then(data => {
        this.notes = data.map(item => ({
          id: item.id,
          text: item.text,
          x: item.x,
          y: item.y
        }));
      });
  },
  watch: {
    backendType() {
      // 切换后端时重新拉取数据，并清空当前内容
      this.notes = [];
      this.inputing = false;
      this.inputText = '';
      this.editingIdx = null;
      fetch(this.backendUrl + '/api/notes')
        .then(res => res.json())
        .then(data => {
          this.notes = data.map(item => ({
            id: item.id,
            text: item.text,
            x: item.x,
            y: item.y
          }));
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
    }
  }
}).mount('#app');