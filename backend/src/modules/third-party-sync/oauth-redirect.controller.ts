import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class OAuthRedirectController {
  @Get()
  oauthRedirect(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    // If there's a code parameter, show a page with instructions
    if (code) {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TIDAL Authorization - Copy Code</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        h1 {
            color: #333;
            margin-top: 0;
            font-size: 24px;
        }
        .code-box {
            background: #f5f5f5;
            border: 2px dashed #667eea;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            word-break: break-all;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            color: #333;
        }
        .instructions {
            color: #666;
            line-height: 1.6;
            margin: 20px 0;
        }
        .button {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            margin-top: 10px;
            transition: background 0.2s;
        }
        .button:hover {
            background: #5568d3;
        }
        .success-icon {
            color: #4caf50;
            font-size: 48px;
            text-align: center;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✓</div>
        <h1>Authorization Successful!</h1>
        <p class="instructions">
            Copy the authorization code below and paste it into the TIDAL authentication dialog in your application.
        </p>
        <div class="code-box" id="codeBox">${code}</div>
        <button class="button" onclick="copyCode()">Copy Code</button>
        <p class="instructions" style="margin-top: 20px; font-size: 12px; color: #999;">
            You can close this window after copying the code.
        </p>
    </div>
    <script>
        function copyCode() {
            const codeBox = document.getElementById('codeBox');
            const text = codeBox.textContent;
            navigator.clipboard.writeText(text).then(() => {
                const button = event.target;
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                button.style.background = '#4caf50';
                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.background = '#667eea';
                }, 2000);
            }).catch(err => {
                alert('Failed to copy. Please manually select and copy the code.');
            });
        }
    </script>
</body>
</html>
      `;
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }

    // If no code, show a simple message
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TIDAL OAuth Redirect</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            text-align: center;
        }
        h1 {
            color: #333;
            margin-top: 0;
        }
        p {
            color: #666;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>TIDAL OAuth Redirect</h1>
        <p>This is the OAuth redirect endpoint for TIDAL authentication.</p>
        <p>You will be redirected here after authorizing the application.</p>
    </div>
</body>
</html>
    `;
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }
}
