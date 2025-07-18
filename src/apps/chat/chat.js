document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');

    // 发送消息的函数
    async function sendMessage() {
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