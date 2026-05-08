describe('index bootstrap', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('creates the React root, renders the app tree, and starts web-vitals reporting', () => {
    const mockRender = jest.fn();
    const mockCreateRoot = jest.fn(() => ({ render: mockRender }));
    const mockReportWebVitals = jest.fn();

    jest.isolateModules(() => {
      jest.doMock('react-dom/client', () => ({
        __esModule: true,
        default: { createRoot: mockCreateRoot },
        createRoot: mockCreateRoot,
      }));
      jest.doMock('./App', () => ({
        __esModule: true,
        default: () => 'app-component',
      }));
      jest.doMock('./reportWebVitals', () => ({
        __esModule: true,
        default: mockReportWebVitals,
      }));
      jest.doMock('./contexts/AuthContext', () => ({
        AuthProvider: ({ children }: any) => children,
      }));

      require('./index');
    });

    expect(mockCreateRoot).toHaveBeenCalledWith(document.getElementById('root'));
    expect(mockRender).toHaveBeenCalledTimes(1);
    expect(mockReportWebVitals).toHaveBeenCalledTimes(1);
  });
});

export {};
