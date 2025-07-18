// AI 客户端封装 - 使用后端代理方式
class SecureAIClient {
  constructor() {
    // 检测环境
    this.backendType = localStorage.getItem('backendType') || 'internal';
    console.log(`[AI Client] 当前环境: ${this.backendType}`);

    // 根据环境设置代理服务器地址
    if (this.backendType === 'internal') {
      this.apiBaseUrl = 'https://SERVER_IP';
      console.log('[AI Client] 使用内网服务器');
    } else {
      this.apiBaseUrl = 'https://47.97.60.69';
      console.log('[AI Client] 使用公网服务器');
    }

    // AI代理API地址
    this.apiUrl = `${this.apiBaseUrl}/api/ai/chat`;

    console.log('[AI Client] 安全客户端已初始化');
  }

  // 生成AI回复
  async generateResponse(userMessage) {
    console.log(`[AI Client] 准备向AI发送消息: ${userMessage}`);

    try {
      // 通过后端代理发送请求，不直接暴露API密钥
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage
        })
      });

      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AI Client] API响应错误 (${response.status}):`, errorText);
        throw new Error(`API请求失败: ${response.status}`);
      }

      // 解析响应
      const data = await response.json();
      console.log('[AI Client] 收到代理响应:', data);

      // 提取文本响应
      if (data.response) {
        const aiResponse = data.response;
        console.log(`[AI Client] AI回复: ${aiResponse.substring(0, 50)}...`);
        return aiResponse;
      } else if (data.error) {
        console.error('[AI Client] 代理返回错误:', data.error);
        throw new Error(data.error);
      } else {
        console.error('[AI Client] 响应格式无效:', data);
        throw new Error('无效的代理响应格式');
      }

    } catch (error) {
      console.error('[AI Client] 生成回复失败:', error);

      // 提供更友好的错误信息
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        if (this.backendType === 'internal') {
          return '无法连接到内网AI代理服务。请检查网络连接或切换到公网环境。';
        } else {
          return '无法连接到公网AI代理服务。请检查网络连接或切换到内网环境。';
        }
      }

      return `AI回复生成失败: ${error.message}。请稍后再试。`;
    }
  }
}

// 创建并导出AI客户端实例
window.aiClient = new SecureAIClient();