import { DeskThing as DK } from 'deskthing-server';
import { google } from 'googleapis';
import express from 'express';

const DeskThing = DK.getInstance();
export { DeskThing };

const calendar = google.calendar('v3');
const app = express();
const PORT = 8889;

type SavedData = {
  client_id?: string;
  client_secret?: string;
  access_token?: string;
  refresh_token?: string;
  redirect_uri?: string;
};

class GoogleCalendarHandler {
  public Data: SavedData = {};
  private auth: any;
  private accessToken: string | null = null;

  constructor() {
    this.initializeData();
  }

  async initializeData() {
    const data = await DeskThing.getData();
    if (data) {
      this.Data = data;
    }

    if (!this.Data.client_id || !this.Data.client_secret) {
      const requestScopes = {
        'client_id': {
          'value': '',
          'label': 'Google Client ID',
          'instructions': 'You can get your Google Client ID from the <a href="https://console.developers.google.com/apis/credentials" target="_blank" style="color: lightblue;">Google Developer Console</a>. Create a new project and then create credentials.',
        },
        'client_secret': {
          'value': '',
          'label': 'Google Client Secret',
          'instructions': 'You can get your Google Client Secret from the <a href="https://console.developers.google.com/apis/credentials" target="_blank" style="color: lightblue;">Google Developer Console</a>. Create a new project and then create credentials.',
        },
        'redirect_uri': {
          'value': 'http://localhost:8889/callback/googlecal',
          'label': 'Redirect URL',
          'instructions': 'Set the Google Redirect URI to http://localhost:8889/callback/googlecal and then click "Save". This ensures you can authenticate your account to this application.',
        }
      };

      DeskThing.getUserInput(requestScopes, (data) => {
        if (data.payload.client_id && data.payload.client_secret) {
          DeskThing.saveData(data.payload);
          this.Data = data.payload;
          this.setupAuth();
          this.sendAuthLinkToConsole();
        } else {
          DeskThing.sendError('Please fill out all the fields! Restart the application to try again.');
        }
      });
    } else {
      DeskThing.sendLog('Data Found!');
      this.setupAuth();
      this.refreshAccessToken();
    }
  }

  setupAuth() {
    this.auth = new google.auth.OAuth2(
      this.Data.client_id,
      this.Data.client_secret,
      this.Data.redirect_uri
    );
  }

  sendAuthLinkToConsole() {
    const authUrl = this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.readonly'],
    });

    DeskThing.sendError(`Please authenticate here: ${authUrl}`);
  }

  async refreshAccessToken() {
    // Logic to refresh access token if needed
    // This can be implemented based on your requirements
  }

  startServer() {
    app.get('/auth', (req, res) => {
      const authUrl = this.auth.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar.readonly'],
      });
      res.redirect(authUrl);
    });

    app.get('/callback/googlecal', async (req, res) => {
      const { code } = req.query;

      if (!code) {
        DeskThing.sendError('No authorization code provided!');
        return res.send('No authorization code provided!');
      }

      try {
        const { tokens } = await this.auth.getToken(code);
        this.auth.setCredentials(tokens);
        this.accessToken = tokens.access_token || null;

        DeskThing.sendDataToClient({
          type: 'authSuccess',
          payload: 'Authentication successful! You can now access your calendar.',
        });

        await this.fetchTodaysCalendarEntries();

        res.send('Authentication successful! You can close this window.');
      } catch (error) {
        DeskThing.sendError('Error exchanging code for tokens: ' + error.message);
        res.send('Error exchanging code for tokens: ' + error.message);
      }

      DeskThing.on('get', async (data) => {
        if (data.type == null) {
          DeskThing.sendError('No args provided!')
          return
        }
        switch (data.request) {
          case 'calendar':
            this.fetchTodaysCalendarEntries
        }
      })
    });

    app.listen(PORT, () => {
      DeskThing.sendLog(`Server is running on http://localhost:${PORT}`);
    });
  }

  

  async fetchTodaysCalendarEntries() {
    if (!this.accessToken) {
      DeskThing.sendError('No access token available. Please authenticate first.');
      return;
    }

    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: (new Date()).toISOString (),
        maxResults: 3,
        singleEvents: true,
        orderBy: 'startTime',
        headers: {
          Authorization: `Bearer ${this.accessToken}`, // Use the access token here
        },
      });

      const events = response.data.items;

      if (events.length) {
        DeskThing.sendDataToClient({
          type: 'calendarEntries',
          payload: events.map(event => ({
            summary: event.summary,
            start: { dateTime: event.start.dateTime || event.start.date },
          })),
        });
      } else {
        DeskThing.sendDataToClient({
          type: 'calendarEntries',
          payload: [], // No events found
        });
      }
    } catch (error) {
      DeskThing.sendError('Error fetching calendar events: ' + error.message);
    }
  }
}

const googleCalendarHandler = new GoogleCalendarHandler();
googleCalendarHandler.startServer();

const stop = async () => {
  DeskThing.sendLog('Server is stopping...');
};

DeskThing.on('stop', stop);