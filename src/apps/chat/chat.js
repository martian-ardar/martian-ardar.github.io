// Vue 应用
const { createApp } = Vue;

// 创建 Vue 应用
const app = createApp({
    data() {
        return {
            isLoggedIn: false,
            username: ''
        };
    },

    mounted() {
        // 从localStorage检查登录状态
        this.checkLoginStatus();

        // 添加消息监听器，用于接收父窗口的登录状态更新
        window.addEventListener('message', this.handleParentMessage);
    },

    beforeUnmount() {
        // 移除消息监听器
        window.removeEventListener('message', this.handleParentMessage);
    },

    methods: {
        // 处理来自父窗口的消息
        handleParentMessage(event) {
            const message = event.data;
            console.log('[Chat] 收到父窗口消息:', message);

            if (message.type === 'updateLoginStatus') {
                this.isLoggedIn = message.isLoggedIn;
                this.username = message.username;
                console.log('[Chat] 已更新登录状态:', this.isLoggedIn, this.username);
            }
        },

        // 检查登录状态
        checkLoginStatus() {
            // 从localStorage检查登录状态
            const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
            const username = localStorage.getItem('username');

            this.isLoggedIn = isLoggedIn;
            this.username = username;

            console.log('[Chat] 检查登录状态:', this.isLoggedIn, this.username);
        }
    }
}).mount('#app');

document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');

    // 发送消息的函数
    async function sendMessage() {
        // 检查登录状态
        if (!app.isLoggedIn) {
            console.warn('用户未登录，无法发送消息');
            return;
        }
        const message = messageInput.value.trim();

        if (message) {
            // 添加用户消息
            addMessage(message, 'user-message');

            // 清空输入框
            messageInput.value = '';

            // 显示正在输入状态
            const typingIndicator = document.createElement('div');
            typingIndicator.classList.add('message', 'system-message', 'typing-indicator');
            typingIndicator.textContent = '正在思考...';
            chatMessages.appendChild(typingIndicator);
            scrollToBottom();

            try {
                let aiResponse;

                // 检查AI客户端是否存在
                if (window.aiClient) {
                    console.log('使用AI客户端生成回复...');
                    aiResponse = await window.aiClient.generateResponse(message);
                } else {
                    console.warn('AI客户端未找到，使用默认回复');
                    aiResponse = '抱歉，AI服务暂时不可用。';
                }

                // 移除正在输入状态
                if (typingIndicator.parentNode) {
                    chatMessages.removeChild(typingIndicator);
                }

                // 添加AI回复
                if (aiResponse) {
                    addMessage(aiResponse, 'system-message');
                } else {
                    throw new Error('收到空回复');
                }

            } catch (error) {
                console.error('获取AI回复时出错:', error);

                // 移除正在输入状态
                if (typingIndicator.parentNode) {
                    chatMessages.removeChild(typingIndicator);
                }

                // 显示错误消息
                let errorMessage = '抱歉，我暂时无法回应，请稍后再试。';
                if (error.message) {
                    errorMessage += ' (错误: ' + error.message + ')';
                }

                addMessage(errorMessage, 'system-message error');
            }
        }
    }

    // 添加消息到聊天窗口
    function addMessage(text, className) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', className);
        messageElement.textContent = text;

        // 将新消息添加到底部
        chatMessages.appendChild(messageElement);

        // 确保新消息显示在最下方
        scrollToBottom();
    }

    // 滚动到底部的函数
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // 点击发送按钮发送消息
    sendButton.addEventListener('click', sendMessage);

    // 按下回车键发送消息
    messageInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });
});