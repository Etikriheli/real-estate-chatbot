// הגדרות מערכת
// הגדרות מערכת - יטען מהשרת
let SUPABASE_URL, SUPABASE_KEY, API_KEY;

// טעינת הגדרות מהשרת
fetch('/config')
  .then(response => response.json())
  .then(config => {
    SUPABASE_URL = config.SUPABASE_URL;
    SUPABASE_KEY = config.SUPABASE_KEY;
    API_KEY = config.API_KEY;
  });

// מצב השיחה
class ConversationState {
    constructor() {
        this.userPreferences = {
            city: null,
            budget: null,
            rooms: null,
            transactionType: null,
            floor: null,
            size: null,
            features: [],
            priorities: {}
        };
        this.conversationFlow = 'greeting';
        this.messageHistory = [];
        this.searchResults = [];
        this.chatCount = 0;
        this.totalCost = 0;
        this.meetingRequested = false;
        this.meetingScheduled = false;
    }

    // עדכון העדפות משתמש
    updatePreferences(newPrefs) {
        Object.assign(this.userPreferences, newPrefs);
        console.log('🎯 Updated preferences:', this.userPreferences);
    }

    // בדיקה אם יש מספיק מידע לחיפוש
    hasMinimalInfo() {
        return this.userPreferences.city && 
               this.userPreferences.transactionType;
    }

    // בדיקה אם יש מידע מלא
    hasCompleteInfo() {
        const required = ['city', 'budget', 'transactionType'];
        return required.every(field => this.userPreferences[field] !== null);
    }

    // קבלת מידע חסר
    getMissingInfo() {
        const fields = {
            city: 'עיר',
            transactionType: 'סוג עסקה (השכרה/קנייה)',
            budget: 'תקציב',
            rooms: 'מספר חדרים',
            floor: 'קומה מועדפת',
            size: 'גודל דירה'
        };
        
        return Object.entries(fields)
            .filter(([key]) => !this.userPreferences[key])
            .map(([, label]) => label);
    }
}

// מחלקה לעיבוד שפה טבעית
class NLPProcessor {
    constructor() {
        this.cityPatterns = {
            'תל אביב': ['תל אביב', 'תלאביב', 'ת"א', 'תא', 'tel aviv', 'telaviv', 'תל אביח', 'תלאביח', 'תל-אביב'],
            'ירושלים': ['ירושלים', 'ירושל', 'ירוש', 'jerusalem', 'ירושליים', 'ירושלם'],
            'חיפה': ['חיפה', 'haifa', 'חיפא', 'חיפ'],
            'רמת גן': ['רמת גן', 'רמתגן', 'רמת-גן', 'רמת גאן', 'רמתגאן'],
            'פתח תקווה': ['פתח תקווה', 'פתחתקווה', 'פת"ת', 'פתח תקוה', 'פתח תקווא'],
            'הרצליה': ['הרצליה', 'הרצלייה', 'הרצלי', 'הרצליא'],
            'נתניה': ['נתניה', 'נתניא', 'נתנייה'],
            'ראשון לציון': ['ראשון לציון', 'ראשוןלציון', 'ראשון', 'ראשל"צ', 'ראשון לצין'],
            'באר שבע': ['באר שבע', 'ב"ש', 'באר שבא', 'באר-שבע'],
            'כפר סבא': ['כפר סבא', 'כפרסבא', 'כפר סבה', 'כפר-סבא']
        };

        this.budgetPatterns = [
            /(\d+)\s*אלף/g,
            /(\d+)\s*k/gi,
            /(\d+),?(\d{3})\s*שקל/g,
            /(\d+),?(\d{3})\s*₪/g,
            /תקציב\s*של?\s*(\d+)/g,
            /עד\s*(\d+)/g,
            /מקסימום\s*(\d+)/g
        ];

        this.roomsPatterns = [
            /(\d+)\s*חדרים?/g,
            /(\d+)\s*ח'/g,
            /סטודיו/g,
            /דירת\s*(\d+)/g
        ];
    }

    // זיהוי עיר מהטקסט עם תיקון שגיאות כתיב
    extractCity(text) {
        const lowerText = text.toLowerCase();
        
        for (const [city, patterns] of Object.entries(this.cityPatterns)) {
            for (const pattern of patterns) {
                if (lowerText.includes(pattern.toLowerCase())) {
                    return city;
                }
            }
        }
        
        // תיקון שגיאות כתיב בעזרת דמיון מחרוזות
        const cityNames = Object.keys(this.cityPatterns);
        const words = lowerText.split(/\s+/);
        
        for (const word of words) {
            if (word.length > 2) {
                for (const city of cityNames) {
                    const cityLower = city.toLowerCase();
                    // בדיקת דמיון - אם יש דמיון גבוה מ-70%
                    if (this.calculateSimilarity(word, cityLower) > 0.7) {
                        return city;
                    }
                }
            }
        }
        
        return null;
    }

    // חישוב דמיון בין מחרוזות (Levenshtein distance)
    calculateSimilarity(str1, str2) {
        const matrix = [];
        const len1 = str1.length;
        const len2 = str2.length;

        if (len1 === 0) return len2 === 0 ? 1 : 0;
        if (len2 === 0) return 0;

        // יצירת מטריצה
        for (let i = 0; i <= len2; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len1; j++) {
            matrix[0][j] = j;
        }

        // מילוי המטריצה
        for (let i = 1; i <= len2; i++) {
            for (let j = 1; j <= len1; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        const distance = matrix[len2][len1];
        const maxLen = Math.max(len1, len2);
        return 1 - (distance / maxLen);
    }

    // זיהוי תקציב
    extractBudget(text) {
        for (const pattern of this.budgetPatterns) {
            const match = text.match(pattern);
            if (match) {
                let amount = parseInt(match[1]);
                if (text.includes('אלף') || text.includes('k')) {
                    amount *= 1000;
                }
                if (match[2]) {
                    amount = amount * 1000 + parseInt(match[2]);
                }
                return amount;
            }
        }
        return null;
    }

    // זיהוי מספר חדרים
    extractRooms(text) {
        if (text.includes('סטודיו')) return 1;
        
        // זיהוי "יותר מ" עם מספרים
        const moreThanMatch = text.match(/יותר\s*מ\s*-?(\d+)/);
        if (moreThanMatch) {
            return { min: parseInt(moreThanMatch[1]) + 1 };
        }
        
        // זיהוי "יותר מ" עם מילים
        if (text.includes('יותר משתי') || text.includes('יותר מ-2')) {
            return { min: 3 };
        }
        if (text.includes('יותר משלוש') || text.includes('יותר מ-3')) {
            return { min: 4 };
        }
        if (text.includes('יותר מארבע') || text.includes('יותר מ-4')) {
            return { min: 5 };
        }
        
        for (const pattern of this.roomsPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return parseInt(match[1]);
            }
        }
        return null;
    }

    // זיהוי סוג עסקה
    extractTransactionType(text) {
        const lowerText = text.toLowerCase();
        
        const rentalKeywords = ['השכרה', 'לשכור', 'להשכיר', 'שוכר', 'דמי שכירות'];
        const saleKeywords = ['מכירה', 'לקנות', 'למכירה', 'קונה', 'רכישה'];
        
        const hasRental = rentalKeywords.some(word => lowerText.includes(word));
        const hasSale = saleKeywords.some(word => lowerText.includes(word));
        
        if (hasRental && !hasSale) return 'השכרה';
        if (hasSale && !hasRental) return 'מכירה';
        return null;
    }

    // זיהוי בקשה לפגישה
    extractMeetingRequest(text) {
        const meetingKeywords = ['פגישה', 'לפגוש', 'להיפגש', 'לקבוע', 'ביקור', 'לבוא', 'לראות'];
        const lowerText = text.toLowerCase();
        return meetingKeywords.some(word => lowerText.includes(word));
    }

    // זיהוי תשובה שלילית לעזרה נוספת
    extractNegativeResponse(text) {
        const negativeKeywords = ['לא', 'לא צריך', 'תודה', 'אין צורך', 'זה הכל', 'די', 'מספיק'];
        const lowerText = text.toLowerCase();
        return negativeKeywords.some(word => lowerText.includes(word));
    }

    // זיהוי אם הטקסט באנגלית
    isEnglishText(text) {
        // בדיקה לתווים לטיניים בלבד (ללא עברית)
        const englishRegex = /^[a-zA-Z0-9\s\.,!?'"()&@#$%^*+=\-_~`]+$/;
        
        // בדיקה למילים אנגליות נפוצות
        const englishWords = [
            'apartment', 'rent', 'buy', 'house', 'room', 'bedroom', 'bathroom',
            'kitchen', 'living', 'price', 'budget', 'location', 'city', 'floor',
            'parking', 'elevator', 'balcony', 'furnished', 'hello', 'hi', 'the',
            'and', 'or', 'in', 'at', 'for', 'with', 'looking', 'search', 'find',
            'want', 'need', 'have', 'can', 'will', 'would', 'should', 'could'
        ];
        
        const lowerText = text.toLowerCase();
        const words = lowerText.split(/\s+/);
        
        // אם הטקסט מכיל רק תווים לטיניים
        if (englishRegex.test(text)) {
            return true;
        }
        
        // אם יותר מ-30% מהמילים הן אנגליות נפוצות
        const englishWordCount = words.filter(word => 
            englishWords.includes(word.replace(/[^\w]/g, ''))
        ).length;
        
        return (englishWordCount / words.length) > 0.3;
    }

    // עיבוד מלא של הטקסט
    processText(text) {
        return {
            city: this.extractCity(text),
            budget: this.extractBudget(text),
            rooms: this.extractRooms(text),
            transactionType: this.extractTransactionType(text),
            meetingRequest: this.extractMeetingRequest(text),
            negativeResponse: this.extractNegativeResponse(text)
        };
    }
}

// מחלקה לחיפוש דירות
class ApartmentSearch {
    constructor() {
        this.lastSearchParams = null;
    }

    async searchApartments(preferences) {
        try {
            console.log('🔍 Searching apartments with preferences:', preferences);

            let url = `${SUPABASE_URL}/rest/v1/apartments?select=*`;
            const params = [];

            // פילטרים בסיסיים
            if (preferences.city) {
                params.push(`city=eq.${encodeURIComponent(preferences.city)}`);
            }

            if (preferences.transactionType) {
                params.push(`transaction_type=eq.${encodeURIComponent(preferences.transactionType)}`);
            }

            if (preferences.rooms) {
                if (typeof preferences.rooms === 'object' && preferences.rooms.min) {
                    params.push(`rooms=gte.${preferences.rooms.min}`);
                } else {
                    params.push(`rooms=eq.${preferences.rooms}`);
                }
            }

            if (preferences.budget) {
                params.push(`price=lte.${preferences.budget}`);
            }

            // מיון ומגבלה
            params.push('order=price.asc');
            params.push('limit=10');

            if (params.length > 2) {
                url += '&' + params.join('&');
            }

            console.log('🌐 Search URL:', url);

            const response = await fetch(url, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Found ${data.length} apartments`);
                this.lastSearchParams = preferences;
                return data;
            } else {
                console.error('❌ Search failed:', response.status);
                return [];
            }
        } catch (error) {
            console.error('💥 Search error:', error);
            return [];
        }
    }

    // יצירת קישור Google Maps
    createGoogleMapsLink(apartment) {
        const address = `${apartment.street || ''}, ${apartment.city}, Israel`;
        const encodedAddress = encodeURIComponent(address);
        return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    }

    // יצירת תיאור דירה מפורט עם קישור למפות
    formatApartment(apartment, index) {
        const features = [];
        if (apartment.furniture && apartment.furniture !== 'ללא ריהוט') {
            features.push(apartment.furniture);
        }
        if (apartment.parking) features.push('חניה');
        if (apartment.elevator) features.push('מעלית');
        if (apartment.balcony) features.push('מרפסת');

        const mapsLink = this.createGoogleMapsLink(apartment);
        const addressText = apartment.street ? `${apartment.street}, ${apartment.city}` : apartment.city;

        return `🏠 **דירה ${index + 1}:**
📍 [${addressText}](${mapsLink})
🛏️ ${apartment.rooms} חדרים | 📐 ${apartment.size_sqm}מ"ר
🏢 קומה ${apartment.floor || 'קרקע'}
💰 ${apartment.price?.toLocaleString()}₪ ל${apartment.transaction_type}
${features.length > 0 ? `✨ ${features.join(', ')}` : ''}`;
    }
}

// מחלקה לניהול השיחה עם AI
class ChatManager {
    constructor() {
        this.state = new ConversationState();
        this.nlp = new NLPProcessor();
        this.search = new ApartmentSearch();
    }

    async processMessage(message) {
        console.log('💬 Processing message:', message);
        
        // בדיקה אם ההודעה באנגלית
        if (this.nlp.isEnglishText(message)) {
            const englishResponse = `Hello! 👋 

I'm Yossi, your Hebrew real estate assistant. I can only communicate in Hebrew.
אני יוסי, הסוכן הדיגיטלי לנדל"ן. אני מדבר רק עברית.
בבקשה כתוב לי בעברית ! 🏠`;

            this.state.messageHistory.push({
                role: 'user',
                content: message,
                timestamp: new Date()
            });
            
            this.state.messageHistory.push({
                role: 'assistant',
                content: englishResponse,
                timestamp: new Date()
            });

            this.state.chatCount++;
            return englishResponse;
        }
        
        // עיבוד המידע מההודעה
        const extractedInfo = this.nlp.processText(message);
        
        // בדיקת בקשה לפגישה - לא לערבב עם חיפוש דירות
        if (extractedInfo.meetingRequest && !this.state.meetingRequested) {
            this.state.meetingRequested = true;
            // לא לעדכן העדפות כשמדובר בפגישה
            this.state.messageHistory.push({
                role: 'user',
                content: message,
                timestamp: new Date()
            });

            const meetingResponse = "מעולה! אשמח לקבוע לך פגישה 📅\nבאיזה יום ושעה נוח לך?";
            
            this.state.messageHistory.push({
                role: 'assistant',
                content: meetingResponse,
                timestamp: new Date()
            });

            this.state.chatCount++;
            this.state.totalCost += 0.003;
            return meetingResponse;
        }

        // בדיקת אישור פגישה - זיהוי יותר רחב של פרטי זמן
        if (this.state.meetingRequested && !this.state.meetingScheduled) {
            const timeIndicators = [
                'יום', 'שעה', 'בבוקר', 'אחר הצהריים', 'בערב', 'מחר', 'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת',
                'ב-', 'אחרי', 'לפני', 'ב10', 'ב11', 'ב12', 'ב13', 'ב14', 'ב15', 'ב16', 'ב17', 'ב18'
            ];
            const hasTimeInfo = timeIndicators.some(indicator => message.toLowerCase().includes(indicator)) || 
                               /\d{1,2}:\d{2}/.test(message) || /\d{1,2}\.\d{2}/.test(message);
            
            if (hasTimeInfo) {
                this.state.meetingScheduled = true;
                
                this.state.messageHistory.push({
                    role: 'user',
                    content: message,
                    timestamp: new Date()
                });

                const confirmResponse = `מצוין! הפגישה נקבעה ל${message} ✅\nיש עוד משהו שאפשר לעזור לך?`;
                
                this.state.messageHistory.push({
                    role: 'assistant',
                    content: confirmResponse,
                    timestamp: new Date()
                });

                this.state.chatCount++;
                this.state.totalCost += 0.003;
                return confirmResponse;
            }
        }

        // בדיקת תשובה שלילית לעזרה נוספת - רק אחרי שהפגישה נקבעה
        if (this.state.meetingScheduled && extractedInfo.negativeResponse) {
            return this.endConversation();
        }

        // עדכון מצב השיחה - רק אם לא מדובר בתהליך פגישה
        if (!this.state.meetingRequested) {
            const updatedPrefs = {};
            Object.entries(extractedInfo).forEach(([key, value]) => {
                if (value !== null && key !== 'meetingRequest' && key !== 'negativeResponse') {
                    updatedPrefs[key] = value;
                }
            });
            
            if (Object.keys(updatedPrefs).length > 0) {
                this.state.updatePreferences(updatedPrefs);
            }
        }

        // הוספת ההודעה להיסטוריה - רק אם לא טופלה כבר
        if (!this.state.meetingRequested || this.state.meetingScheduled) {
            this.state.messageHistory.push({
                role: 'user',
                content: message,
                timestamp: new Date()
            });
        }

        // חיפוש דירות אם יש מספיק מידע - רק אם לא במצב פגישה
        let apartments = [];
        if (this.state.hasMinimalInfo() && !this.state.meetingRequested) {
            apartments = await this.search.searchApartments(this.state.userPreferences);
            this.state.searchResults = apartments;
        }

        // יצירת תגובה
        const response = await this.generateResponse(message, apartments);
        
        this.state.messageHistory.push({
            role: 'assistant',
            content: response,
            timestamp: new Date()
        });

        this.state.chatCount++;
        this.state.totalCost += 0.003;

        return response;
    }

    async generateResponse(message, apartments) {
        const preferences = this.state.userPreferences;
        const missingInfo = this.state.getMissingInfo();
        
        // בניית הקשר לשיחה
        const conversationContext = this.state.messageHistory
            .slice(-6)
            .map(msg => `${msg.role === 'user' ? 'משתמש' : 'יוסי'}: ${msg.content}`)
            .join('\n');

        let systemPrompt = `אתה יוסי - סוכן דירות ידידותי וקצר! 

**המידע שיש לי על המשתמש:**
${Object.entries(preferences)
    .filter(([_, value]) => value !== null)
    .map(([key, value]) => `• ${this.getFieldName(key)}: ${value}`)
    .join('\n') || '• עדיין לא נאסף מידע'}

**הוראות מחייבות:**`;

        if (apartments.length > 0 && this.state.hasCompleteInfo()) {
            // יש דירות ומידע מלא - הצג תוצאות
            const apartmentsList = apartments
                .slice(0, 3)
                .map((apt, i) => this.search.formatApartment(apt, i))
                .join('\n\n');

            systemPrompt += `
🎯 **מצאתי ${apartments.length} דירות מתאימות!**

${apartmentsList}

**משימתך:**
1. הצג את הדירות
2. תן המלצה קצרה על הדירה הטובה ביותר
3. שאל אם רוצה פרטים נוספים
4. תגובה קצרה של עד 2 שורות בלבד

אל תמציא פרטים שלא קיימים!`;

        } else if (missingInfo.length > 0) {
            // חסר מידע - המשך איסוף
            systemPrompt += `
📝 **חסרים לי עוד פרטים:**
${missingInfo.map(info => `• ${info}`).join('\n')}

**משימתך:**
1. שאל על הפרט החשוב הבא
2. תגובה קצרה של עד 2 שורות
3. שאלה אחת בלבד
4. השתמש באמוג'י

התחל עם השאלה הכי חשובה!`;

        } else if (this.state.hasMinimalInfo() && apartments.length === 0) {
            // יש מידע בסיסי אבל אין תוצאות
            systemPrompt += `
😔 **לא מצאתי דירות מתאימות.**

**משימתך:**
1. הצע לשנות קריטריון אחד
2. תגובה קצרה של עד 2 שורות
3. היה אופטימי`;

        } else {
            // שיחת פתיחה או מצב כללי או טיפול בפגישות
            if (this.state.meetingRequested && !this.state.meetingScheduled) {
                systemPrompt += `
📅 **המשתמש ביקש לקבוע פגישה.**

**משימתך:**
1. שאל באיזה יום ושעה נוח לו
2. היה ידידותי ומקצועי
3. תגובה קצרה של עד 2 שורות`;

            } else if (this.state.meetingScheduled) {
                systemPrompt += `
✅ **הפגישה נקבעה!**

**משימתך:**
1. אשר את הפגישה
2. שאל אם יש עוד משהו שאפשר לעזור
3. תגובה קצרה של עד 2 שורות`;

            } else {
                systemPrompt += `
👋 **ברוך הבא! אני כאן לעזור למצוא דירה.**

**משימתך:**
1. היה חם וקצר
2. שאל על עיר וסוג עסקה
3. תגובה של עד 2 שורות
4. השתמש באמוג'י`;
            }
        }

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: message
                        }
                    ],
                    max_tokens: apartments.length > 0 ? 800 : 200,
                    temperature: 0.7
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.choices[0].message.content;
            } else {
                console.error('❌ OpenAI API error:', response.status);
                return 'מצטער, יש לי בעיה טכנית קטנה. תנסה שוב בעוד רגע? 😊';
            }
        } catch (error) {
            console.error('💥 AI error:', error);
            return 'יש לי בעיה זמנית בחיבור. בוא ננסה שוב? 🔄';
        }
    }

    endConversation() {
        const endMessage = 'תודה רבה! 😊 היה לי כיף לעזור לך. אני מקווה שנמצא את הדירה המושלמת! 🏠✨';
        
        this.state.messageHistory.push({
            role: 'assistant',
            content: endMessage,
            timestamp: new Date()
        });

        this.state.chatCount++;
        this.state.totalCost += 0.003;

        // הוספת כפתור התחלת שיחה חדשה
        setTimeout(() => {
            const newChatButton = document.createElement('button');
            newChatButton.textContent = 'התחל שיחה חדשה';
            newChatButton.className = 'new-chat-btn';
            newChatButton.style.cssText = `
                background: #4285f4;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 25px;
                cursor: pointer;
                margin: 10px;
                font-family: inherit;
                font-size: 14px;
                box-shadow: 0 2px 8px rgba(66, 133, 244, 0.3);
            `;
            newChatButton.onclick = () => location.reload();
            
            const messagesDiv = document.getElementById('messages');
            messagesDiv.appendChild(newChatButton);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, 1000);

        return endMessage;
    }

    getFieldName(key) {
        const fieldNames = {
            city: 'עיר',
            budget: 'תקציב',
            rooms: 'חדרים',
            transactionType: 'סוג עסקה',
            floor: 'קומה',
            size: 'גודל'
        };
        return fieldNames[key] || key;
    }
}

// אתחול המערכת
const chatManager = new ChatManager();

// אלמנטים מה-DOM
const messagesDiv = document.getElementById('messages');
const inputEl = document.getElementById('input');
const statusEl = document.getElementById('status');
const usageEl = document.getElementById('usage');

// פונקציות UI
function addMessage(sender, text) {
    const div = document.createElement('div');
    div.className = 'message';
    const msgClass = sender === 'user' ? 'user-msg' : 'bot-msg';
    const time = new Date().toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'});
    
    // המרת markdown links לHTML
    let processedText = text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" style="color: #4285f4; text-decoration: underline;">$1</a>');
    
    div.innerHTML = `
        <div class="${msgClass}">
            ${processedText}
            <div class="time">${time}</div>
        </div>
    `;
    
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function showTyping() {
    const div = document.createElement('div');
    div.className = 'typing';
    div.id = 'typing';
    div.innerHTML = '<div class="typing-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function hideTyping() {
    const typing = document.getElementById('typing');
    if (typing) typing.remove();
}

function updateUsage() {
    const { chatCount, totalCost } = chatManager.state;
    usageEl.textContent = `שיחות: ${chatCount} | עלות: ${totalCost.toFixed(3)}`;
}

// פונקציה ראשית לשליחת הודעה
async function send() {
    const message = inputEl.value.trim();
    if (!message) return;

    addMessage('user', message);
    inputEl.value = '';
    showTyping();

    try {
        const response = await chatManager.processMessage(message);
        hideTyping();
        addMessage('bot', response);
        updateUsage();
    } catch (error) {
        hideTyping();
        console.error('💥 Send error:', error);
        addMessage('bot', 'מצטער, יש בעיה טכנית. בוא ננסה שוב? 🔄');
    }
}

// פונקציה להגדרת טקסט בשדה הקלט
function setInput(text) {
    inputEl.value = text;
    inputEl.focus();
}

// מאזיני אירועים
inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
    }
});

// אתחול היישום
window.addEventListener('load', () => {
    addMessage('bot', 'היי! 👋 אני יוסי, הסוכן הדיגיטלי שלך לחיפוש דירות!\n\nאני כאן לעזור לך למצוא את הדירה המושלמת. ספר לי - באיזה עיר אתה מחפש? וזה לקנייה או להשכרה? 🏠✨');
    updateUsage();
});
