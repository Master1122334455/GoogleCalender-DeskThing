import React, { useEffect, useState } from 'react';
import { DeskThing } from 'deskthing-client';
import { SocketData } from 'deskthing-server';

interface CalendarEntry {
  summary: string;
  start: {
    dateTime: string;
  };
}

const App: React.FC = () => {
  const deskthing = DeskThing.getInstance();
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleData = (data: SocketData) => {
      switch (data.type) {
        case 'calendarEntries':
          setCalendarEntries(data.payload as CalendarEntry[]);
          setErrorMessage(null);
          break;

        case 'error':
          setErrorMessage(data.payload as string);
          break;
        default:
          console.error('Unknown data type:', data.type);
      }
    };

    deskthing.on('calendarEntries', handleData);
    deskthing.on('error', handleData);

    // Request calendar entries when the app is opened

      deskthing.send({ type: 'get', request: 'calendar' });


    return () => {
      deskthing.off('calendarEntries', handleData);
      deskthing.off('error', handleData);
    };
  }, [deskthing]);

  const handleRequestCalendarEntries = () => {
      deskthing.send({ type: 'get', request: 'calendar' });
  };

  // Function to convert time to PST
  const convertToPST = (dateTime: string) => {
    const date = new Date(dateTime);
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'America/Los_Angeles', // PST/PDT timezone
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    };
    return date.toLocaleTimeString('en-US', options);
  };

  return (
    <div className="bg-slate-800 w-screen h-screen flex justify-center items-center">
      {errorMessage && (
        <div className="text-red-500">
          <p>{errorMessage}</p>
        </div>
      )}
      <div className="w-full max-w-md">
        {calendarEntries.length === 0 ? (
          <>
            <p className="font-bold text-6xl text-white text-center">Calendar Entries</p>
            <button onClick={handleRequestCalendarEntries} className="mt-4 p-3 bg-green-500 text-white rounded w-full text-lg">Request Calendar Entries</button>
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-3xl font-bold text-center mb-4">Today's Calendar</h2>
            <ul className="space-y-4">
              {calendarEntries.map((entry, index) => {
                const time = convertToPST(entry.start.dateTime);
                return (
                  <li key={index} className="flex justify-between p-4 border-b border-gray-300 text-lg">
                    <span className="text-gray-800">{entry.summary}</span>
                    <span className="text-gray-600">{time}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;