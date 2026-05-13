// @ts-nocheck
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClientForm } from './ClientForm';

describe('ClientForm', () => {
  describe('Create mode (mode="create")', () => {
    it('should NOT render is_active toggle in create mode', () => {
      const onSubmit = jest.fn();
      const onNameChange = jest.fn();

      render(
        <ClientForm
          mode="create"
          initialValues={{}}
          onSubmit={onSubmit}
          onNameChange={onNameChange}
        />
      );

      // Toggle should not be present
      const statusLabel = screen.queryByText('סטטוס לקוח');
      expect(statusLabel).not.toBeInTheDocument();

      const toggleLabel = screen.queryByText(/פעיל|לא פעיל/);
      expect(toggleLabel).not.toBeInTheDocument();
    });

    it('should always submit is_active=true in create mode', () => {
      const onSubmit = jest.fn();
      const onNameChange = jest.fn();

      render(
        <ClientForm
          mode="create"
          initialValues={{}}
          onSubmit={onSubmit}
          onNameChange={onNameChange}
          id="test-form"
        />
      );

      const nameInput = screen.getByPlaceholderText('מה שם הלקוח');
      fireEvent.change(nameInput, { target: { value: 'Test Client' } });

      fireEvent.submit(nameInput.form);

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Client',
          is_active: true,
        })
      );
    });
  });

  describe('Edit mode (mode="edit")', () => {
    it('should render is_active toggle in edit mode', () => {
      const onSubmit = jest.fn();
      const onNameChange = jest.fn();

      render(
        <ClientForm
          mode="edit"
          initialValues={{ name: 'Existing Client', is_active: true }}
          onSubmit={onSubmit}
          onNameChange={onNameChange}
        />
      );

      const statusLabel = screen.getByText('סטטוס לקוח');
      expect(statusLabel).toBeInTheDocument();

      const statusText = screen.getByText('פעיל');
      expect(statusText).toBeInTheDocument();
    });

    it('should initialize toggle to is_active value from initialValues', () => {
      const onSubmit = jest.fn();
      const onNameChange = jest.fn();

      const { rerender } = render(
        <ClientForm
          mode="edit"
          initialValues={{ name: 'Client 1', is_active: true }}
          onSubmit={onSubmit}
          onNameChange={onNameChange}
        />
      );

      let statusText = screen.getByText('פעיל');
      expect(statusText).toBeInTheDocument();

      rerender(
        <ClientForm
          mode="edit"
          initialValues={{ name: 'Client 2', is_active: false }}
          onSubmit={onSubmit}
          onNameChange={onNameChange}
        />
      );

      const inactiveText = screen.getByText('לא פעיל');
      expect(inactiveText).toBeInTheDocument();
    });

    it('should toggle is_active when checkbox is clicked', () => {
      const onSubmit = jest.fn();
      const onNameChange = jest.fn();

      render(
        <ClientForm
          mode="edit"
          initialValues={{ name: 'Test Client', is_active: true }}
          onSubmit={onSubmit}
          onNameChange={onNameChange}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();

      fireEvent.click(checkbox);

      expect(checkbox).not.toBeChecked();
      const inactiveText = screen.getByText('לא פעיל');
      expect(inactiveText).toBeInTheDocument();
    });

    it('should submit the toggled is_active value in edit mode', () => {
      const onSubmit = jest.fn();
      const onNameChange = jest.fn();

      render(
        <ClientForm
          mode="edit"
          initialValues={{ name: 'Test Client', is_active: true }}
          onSubmit={onSubmit}
          onNameChange={onNameChange}
          id="test-form"
        />
      );

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      fireEvent.submit(checkbox.form);

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Client',
          is_active: false,
        })
      );
    });
  });

  describe('Common behavior', () => {
    it('should render name and contact_info fields in both modes', () => {
      const onSubmit = jest.fn();
      const onNameChange = jest.fn();

      render(
        <ClientForm
          mode="create"
          initialValues={{}}
          onSubmit={onSubmit}
          onNameChange={onNameChange}
        />
      );

      expect(screen.getByText('שם הלקוח')).toBeInTheDocument();
      expect(screen.getByText('פרטי קשר')).toBeInTheDocument();
    });

    it('should call onNameChange callback when name input changes', () => {
      const onSubmit = jest.fn();
      const onNameChange = jest.fn();

      render(
        <ClientForm
          mode="create"
          initialValues={{}}
          onSubmit={onSubmit}
          onNameChange={onNameChange}
        />
      );

      const nameInput = screen.getByPlaceholderText('מה שם הלקוח');
      fireEvent.change(nameInput, { target: { value: 'New Name' } });

      expect(onNameChange).toHaveBeenCalledWith('New Name');
    });
  });
});


