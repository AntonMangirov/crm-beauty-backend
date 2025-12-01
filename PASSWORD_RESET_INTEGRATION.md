# Документация по интеграции SMS и Email сервисов для восстановления пароля

## Обзор

Система восстановления пароля реализована с заглушками для отправки SMS и Email. Для полноценной работы необходимо интегрировать реальные сервисы отправки сообщений.

## Текущая реализация

### Файлы с заглушками

1. **`src/utils/passwordReset.ts`** - содержит функции:
   - `sendResetCodeToEmail()` - заглушка для отправки email
   - `sendResetCodeToPhone()` - заглушка для отправки SMS

### Текущее поведение

В режиме разработки (`NODE_ENV !== 'production'`):
- Коды восстановления выводятся в консоль сервера
- Email и SMS не отправляются реально

В production режиме:
- Функции возвращают `true` без реальной отправки
- Необходимо интегрировать реальные сервисы

## Интеграция Email сервисов

### Вариант 1: SendGrid

```bash
npm install @sendgrid/mail
```

```typescript
// src/utils/passwordReset.ts
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendResetCodeToEmail(
  email: string,
  code: string
): Promise<boolean> {
  try {
    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL!,
      subject: 'Восстановление пароля',
      html: `
        <h2>Восстановление пароля</h2>
        <p>Ваш код для восстановления пароля: <strong>${code}</strong></p>
        <p>Код действителен в течение 15 минут.</p>
        <p>Если вы не запрашивали восстановление пароля, проигнорируйте это письмо.</p>
      `,
    };

    await sgMail.send(msg);
    return true;
  } catch (error) {
    logError(`Ошибка отправки email на ${email}`, error);
    return false;
  }
}
```

**Переменные окружения:**
```env
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

### Вариант 2: Mailgun

```bash
npm install mailgun.js form-data
```

```typescript
// src/utils/passwordReset.ts
import formData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY!,
});

export async function sendResetCodeToEmail(
  email: string,
  code: string
): Promise<boolean> {
  try {
    await mg.messages.create(process.env.MAILGUN_DOMAIN!, {
      from: process.env.MAILGUN_FROM_EMAIL!,
      to: [email],
      subject: 'Восстановление пароля',
      html: `
        <h2>Восстановление пароля</h2>
        <p>Ваш код для восстановления пароля: <strong>${code}</strong></p>
        <p>Код действителен в течение 15 минут.</p>
        <p>Если вы не запрашивали восстановление пароля, проигнорируйте это письмо.</p>
      `,
    });
    return true;
  } catch (error) {
    logError(`Ошибка отправки email на ${email}`, error);
    return false;
  }
}
```

**Переменные окружения:**
```env
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_FROM_EMAIL=noreply@yourdomain.com
```

### Вариант 3: AWS SES

```bash
npm install @aws-sdk/client-ses
```

```typescript
// src/utils/passwordReset.ts
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function sendResetCodeToEmail(
  email: string,
  code: string
): Promise<boolean> {
  try {
    const command = new SendEmailCommand({
      Source: process.env.AWS_SES_FROM_EMAIL!,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: 'Восстановление пароля',
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: `
              <h2>Восстановление пароля</h2>
              <p>Ваш код для восстановления пароля: <strong>${code}</strong></p>
              <p>Код действителен в течение 15 минут.</p>
              <p>Если вы не запрашивали восстановление пароля, проигнорируйте это письмо.</p>
            `,
            Charset: 'UTF-8',
          },
        },
      },
    });

    await sesClient.send(command);
    return true;
  } catch (error) {
    logError(`Ошибка отправки email на ${email}`, error);
    return false;
  }
}
```

**Переменные окружения:**
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_SES_FROM_EMAIL=noreply@yourdomain.com
```

### Вариант 4: Nodemailer с SMTP

```bash
npm install nodemailer
```

```typescript
// src/utils/passwordReset.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendResetCodeToEmail(
  email: string,
  code: string
): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM_EMAIL,
      to: email,
      subject: 'Восстановление пароля',
      html: `
        <h2>Восстановление пароля</h2>
        <p>Ваш код для восстановления пароля: <strong>${code}</strong></p>
        <p>Код действителен в течение 15 минут.</p>
        <p>Если вы не запрашивали восстановление пароля, проигнорируйте это письмо.</p>
      `,
    });
    return true;
  } catch (error) {
    logError(`Ошибка отправки email на ${email}`, error);
    return false;
  }
}
```

**Переменные окружения:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_EMAIL=noreply@yourdomain.com
```

## Интеграция SMS сервисов

### Вариант 1: Twilio

```bash
npm install twilio
```

```typescript
// src/utils/passwordReset.ts
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function sendResetCodeToPhone(
  phone: string,
  code: string
): Promise<boolean> {
  try {
    await client.messages.create({
      body: `Ваш код для восстановления пароля: ${code}. Код действителен 15 минут.`,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: phone,
    });
    return true;
  } catch (error) {
    logError(`Ошибка отправки SMS на ${phone}`, error);
    return false;
  }
}
```

**Переменные окружения:**
```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### Вариант 2: SMS.ru

```bash
npm install smsru
```

```typescript
// src/utils/passwordReset.ts
import SMSRu from 'smsru';

const smsru = new SMSRu(process.env.SMSRU_API_ID!);

export async function sendResetCodeToPhone(
  phone: string,
  code: string
): Promise<boolean> {
  try {
    // Нормализуем номер для SMS.ru (убираем +)
    const normalizedPhone = phone.replace(/\+/g, '');
    
    await smsru.sms.send({
      to: normalizedPhone,
      text: `Ваш код для восстановления пароля: ${code}. Код действителен 15 минут.`,
    });
    return true;
  } catch (error) {
    logError(`Ошибка отправки SMS на ${phone}`, error);
    return false;
  }
}
```

**Переменные окружения:**
```env
SMSRU_API_ID=your_smsru_api_id
```

### Вариант 3: Smsc.ru

```bash
npm install axios
```

```typescript
// src/utils/passwordReset.ts
import axios from 'axios';

export async function sendResetCodeToPhone(
  phone: string,
  code: string
): Promise<boolean> {
  try {
    // Нормализуем номер для Smsc.ru (убираем +)
    const normalizedPhone = phone.replace(/\+/g, '');
    
    const response = await axios.get('https://smsc.ru/sys/send.php', {
      params: {
        login: process.env.SMSC_LOGIN!,
        psw: process.env.SMSC_PASSWORD!,
        phones: normalizedPhone,
        mes: `Ваш код для восстановления пароля: ${code}. Код действителен 15 минут.`,
        charset: 'utf-8',
        fmt: 3, // JSON формат ответа
      },
    });

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    return true;
  } catch (error) {
    logError(`Ошибка отправки SMS на ${phone}`, error);
    return false;
  }
}
```

**Переменные окружения:**
```env
SMSC_LOGIN=your_smsc_login
SMSC_PASSWORD=your_smsc_password
```

### Вариант 4: AWS SNS

```bash
npm install @aws-sdk/client-sns
```

```typescript
// src/utils/passwordReset.ts
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function sendResetCodeToPhone(
  phone: string,
  code: string
): Promise<boolean> {
  try {
    const command = new PublishCommand({
      PhoneNumber: phone,
      Message: `Ваш код для восстановления пароля: ${code}. Код действителен 15 минут.`,
    });

    await snsClient.send(command);
    return true;
  } catch (error) {
    logError(`Ошибка отправки SMS на ${phone}`, error);
    return false;
  }
}
```

**Переменные окружения:**
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

## Шаги для интеграции

1. **Выберите сервис** для Email и/или SMS
2. **Установите необходимые пакеты** через npm
3. **Добавьте переменные окружения** в `.env` файл
4. **Замените заглушки** в `src/utils/passwordReset.ts` на реальную реализацию
5. **Протестируйте** отправку кодов в тестовом режиме
6. **Настройте production** переменные окружения на сервере

## Безопасность

- Никогда не коммитьте API ключи в репозиторий
- Используйте переменные окружения для всех секретов
- Ограничьте частоту запросов восстановления пароля (rate limiting)
- Используйте HTTPS для всех запросов
- Валидируйте форматы email и телефонов перед отправкой

## Тестирование

После интеграции протестируйте:
1. Отправку кода на email
2. Отправку кода на телефон
3. Проверку кода
4. Сброс пароля
5. Обработку ошибок (неверный код, истекший токен и т.д.)

## Миграция базы данных

После добавления модели `PasswordResetToken` выполните миграцию:

```bash
cd crm-beauty-backend
npx prisma migrate dev --name add_password_reset_token
```

Или для production:

```bash
npx prisma migrate deploy
```

## Дополнительные улучшения

1. **Rate limiting** - ограничение количества запросов восстановления с одного IP
2. **Логирование** - детальное логирование всех попыток восстановления
3. **Мониторинг** - отслеживание успешности отправки сообщений
4. **Шаблоны сообщений** - использование шаблонизаторов для красивых писем/SMS
5. **Мультиязычность** - поддержка разных языков в сообщениях








