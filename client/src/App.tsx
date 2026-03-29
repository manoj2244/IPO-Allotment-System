import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Layout,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { InboxOutlined, LogoutOutlined, ReloadOutlined, SendOutlined, UploadOutlined } from '@ant-design/icons';
import { Controller, useForm } from 'react-hook-form';
import axios from 'axios';
import dayjs from 'dayjs';
import { api } from './lib/api';
import type { AddressItem, Ipo, IpoEntry, LoginResponse, Role } from './types';

const { Header, Content } = Layout;
const { Dragger } = Upload;

type Session = LoginResponse['user'] & { token: string };

type IpoForm = {
  companyName: string;
  companyCode: string;
  pricePerUnit: number;
  district: string;
  issuedUnits: number;
  minUnits: number;
  maxUnits: number;
  status: 'ACTIVE' | 'INACTIVE';
};

type EntryForm = {
  formNo: string;
  dateBs: string;
  boid: string;
  name: string;
  fatherName: string;
  grandfatherName: string;
  citizenshipNo: string;
  bankName: string;
  accountNo: string;
  mobileNo: string;
  appliedUnits: number;
  remarks?: string;
  panNo?: string;
};

type UserForm = {
  fullName: string;
  email: string;
  password: string;
  role: Role;
};

function App() {
  const { message } = AntApp.useApp();
  const [session, setSession] = useState<Session | null>(() => {
    const cached = localStorage.getItem('ipo_session');
    if (!cached) return null;
    return JSON.parse(cached) as Session;
  });
  const [loading, setLoading] = useState(false);
  const [ipos, setIpos] = useState<Ipo[]>([]);
  const [selectedIpoId, setSelectedIpoId] = useState<number | null>(null);
  const [entries, setEntries] = useState<IpoEntry[]>([]);
  const [users, setUsers] = useState<Array<{ id: number; fullName: string; email: string; role: Role; isActive: boolean }>>([]);
  const [banks, setBanks] = useState<string[]>([]);
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [savingIpo, setSavingIpo] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [savingUser, setSavingUser] = useState(false);

  const ipoForm = useForm<IpoForm>({
    defaultValues: {
      companyName: '',
      companyCode: '',
      pricePerUnit: 100,
      district: 'Kathmandu',
      issuedUnits: 0,
      minUnits: 10,
      maxUnits: 100,
      status: 'ACTIVE',
    },
  });

  const entryForm = useForm<EntryForm>({
    defaultValues: {
      formNo: '',
      dateBs: '',
      boid: '',
      name: '',
      fatherName: '',
      grandfatherName: '',
      citizenshipNo: '',
      bankName: '',
      accountNo: '',
      mobileNo: '',
      appliedUnits: 10,
      remarks: '',
      panNo: '',
    },
  });

  const userForm = useForm<UserForm>({
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      role: 'STAFF',
    },
  });

  const selectedIpo = useMemo(() => ipos.find((item) => item.id === selectedIpoId) || null, [ipos, selectedIpoId]);
  const districtOptions = useMemo(() => {
    const districts = Array.from(new Set(addresses.map((item) => item.district).filter((item) => !!item)));
    return districts.sort((a, b) => a.localeCompare(b));
  }, [addresses]);

  const getErrorMessage = (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const messageFromApi = (error.response?.data as { message?: string | string[] } | undefined)?.message;
      if (Array.isArray(messageFromApi)) return messageFromApi.join(', ');
      if (messageFromApi) return messageFromApi;
      return error.message;
    }
    if (error instanceof Error) return error.message;
    return 'Request failed';
  };

  const saveSession = (payload: Session | null) => {
    setSession(payload);
    if (!payload) {
      localStorage.removeItem('ipo_session');
      localStorage.removeItem('ipo_token');
      return;
    }
    localStorage.setItem('ipo_session', JSON.stringify(payload));
    localStorage.setItem('ipo_token', payload.token);
  };

  const loadIpos = async () => {
    const endpoint = session?.role === 'ADMIN' ? '/ipos?includeInactive=true' : '/ipos/active';
    const { data } = await api.get<Ipo[]>(endpoint);
    setIpos(data);
    if (!selectedIpoId && data.length > 0) {
      setSelectedIpoId(data[0].id);
    }
  };

  const loadEntries = async (ipoId: number) => {
    const { data } = await api.get<IpoEntry[]>(`/entries/ipo/${ipoId}`);
    setEntries(data);
  };

  const loadUsers = async () => {
    if (session?.role !== 'ADMIN') return;
    const { data } = await api.get('/users');
    setUsers(data);
  };

  const loadReferenceData = async () => {
    try {
      const [{ data: bankData }, { data: addressData }] = await Promise.all([
        api.get<string[]>('/public-data/banks'),
        api.get<AddressItem[]>('/public-data/addresses'),
      ]);
      setBanks(bankData);
      setAddresses(addressData);
    } catch (error) {
      message.warning('Could not load bank/address master data');
    }
  };

  useEffect(() => {
    if (!session) return;
    void loadIpos();
    void loadUsers();
    void loadReferenceData();
  }, [session]);

  useEffect(() => {
    if (!selectedIpoId || !session) return;
    void loadEntries(selectedIpoId);
  }, [selectedIpoId, session]);

  const onLogin = async (values: { email: string; password: string }) => {
    try {
      setLoading(true);
      const { data } = await api.post<LoginResponse>('/auth/login', values);
      saveSession({ ...data.user, token: data.accessToken });
      message.success('Login successful');
    } catch {
      message.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const onCreateIpo = async (values: IpoForm) => {
    try {
      setSavingIpo(true);
      await api.post('/ipos', values);
      message.success('IPO created');
      ipoForm.reset();
      await loadIpos();
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setSavingIpo(false);
    }
  };

  const onCreateIpoInvalid = () => {
    const fields = Object.keys(ipoForm.formState.errors);
    message.error(fields.length ? `Fill required IPO fields: ${fields.join(', ')}` : 'Invalid IPO form');
  };

  const onCreateEntry = async (values: EntryForm) => {
    if (!selectedIpoId || !selectedIpo) {
      message.warning('Select IPO first');
      return;
    }

    if (values.appliedUnits < selectedIpo.minUnits || values.appliedUnits > selectedIpo.maxUnits) {
      message.error(`Applied units must be between ${selectedIpo.minUnits} and ${selectedIpo.maxUnits}`);
      return;
    }

    try {
      setSavingEntry(true);
      await api.post(`/entries/ipo/${selectedIpoId}`, values);
      message.success('Entry saved');
      entryForm.reset();
      await loadEntries(selectedIpoId);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setSavingEntry(false);
    }
  };

  const onCreateEntryInvalid = () => {
    const fields = Object.keys(entryForm.formState.errors);
    message.error(fields.length ? `Fill required entry fields: ${fields.join(', ')}` : 'Invalid entry form');
  };

  const onCreateUser = async (values: UserForm) => {
    try {
      setSavingUser(true);
      await api.post('/users', values);
      message.success('User created');
      userForm.reset();
      await loadUsers();
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setSavingUser(false);
    }
  };

  const onCreateUserInvalid = () => {
    const fields = Object.keys(userForm.formState.errors);
    message.error(fields.length ? `Fill required user fields: ${fields.join(', ')}` : 'Invalid user form');
  };

  const parseDateBsToDayjs = (value?: string) => {
    if (!value) return null;
    const [d, m, y] = value.split('/');
    if (!d || !m || !y) return null;
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const parsed = dayjs(iso);
    return parsed.isValid() ? parsed : null;
  };

  const onUploadEntryExcel = async (file: File) => {
    if (!selectedIpoId) {
      message.warning('Select IPO first');
      return false;
    }

    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await api.post(`/entries/ipo/${selectedIpoId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      message.success(`Uploaded. Success: ${data.successCount}, Failed: ${data.failedCount}`);
      await loadEntries(selectedIpoId);
    } catch (error) {
      message.error(getErrorMessage(error));
    }
    return false;
  };

  const onUploadAllotment = async (file: File) => {
    if (!selectedIpoId) {
      message.warning('Select IPO first');
      return false;
    }

    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await api.post(`/allotments/ipo/${selectedIpoId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success(`Allotment uploaded. Rows: ${data.totalRows}`);
    } catch (error) {
      message.error(getErrorMessage(error));
    }
    return false;
  };

  const onExportEntries = () => {
    if (!selectedIpoId) return;
    window.open(`${api.defaults.baseURL}/entries/export?ipoId=${selectedIpoId}`, '_blank');
  };

  const onExportRefund = () => {
    if (!selectedIpoId) return;
    window.open(`${api.defaults.baseURL}/allotments/ipo/${selectedIpoId}/refund-report/export`, '_blank');
  };

  const onSendAllotmentEmails = async () => {
    if (!selectedIpoId) return;
    try {
      const { data } = await api.post(`/allotments/ipo/${selectedIpoId}/send-emails`);
      message.success(`${data.sent} emails sent`);
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  };

  if (!session) {
    return (
      <Layout style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <Card title="IPO Form Entry System Login" style={{ width: 420 }}>
          <Form layout="vertical" onFinish={onLogin}>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
              <Input placeholder="admin@ipo.local" />
            </Form.Item>
            <Form.Item name="password" label="Password" rules={[{ required: true }]}>
              <Input.Password placeholder="Pass@123" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Login
            </Button>
          </Form>
          <Alert
            showIcon
            style={{ marginTop: 16 }}
            message="Default seed users"
            description="admin@ipo.local / Pass@123 and staff@ipo.local / Pass@123"
            type="info"
          />
        </Card>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#001529',
        }}
      >
        <Space>
          <Typography.Title style={{ margin: 0, color: '#fff' }} level={4}>
            IPO Form Entry System
          </Typography.Title>
          <Tag color="blue">{session.role}</Tag>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void loadIpos()}>
            Refresh
          </Button>
          <Button icon={<LogoutOutlined />} danger onClick={() => saveSession(null)}>
            Logout
          </Button>
        </Space>
      </Header>
      <Content style={{ padding: 16 }}>
        <Card>
          <Row gutter={12} align="middle">
            <Col xs={24} md={12} lg={8}>
              <Typography.Text strong>Select IPO:</Typography.Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                value={selectedIpoId ?? undefined}
                onChange={(value) => setSelectedIpoId(value)}
                options={ipos.map((ipo) => ({
                  value: ipo.id,
                  label: `${ipo.companyCode} - ${ipo.companyName}`,
                }))}
              />
            </Col>
            {selectedIpo && (
              <Col xs={24} md={12} lg={16}>
                <Space wrap>
                  <Tag color="purple">District: {selectedIpo.district}</Tag>
                  <Tag color="green">Price: {selectedIpo.pricePerUnit}</Tag>
                  <Tag color="gold">Units: {selectedIpo.minUnits} - {selectedIpo.maxUnits}</Tag>
                </Space>
              </Col>
            )}
          </Row>
        </Card>

        <Tabs
          style={{ marginTop: 16 }}
          items={[
            ...(session.role === 'ADMIN'
              ? [
                  {
                    key: 'ipoSetup',
                    label: 'IPO Setup',
                    children: (
                      <Card title="Create IPO">
                        <form onSubmit={(event) => event.preventDefault()}>
                          <Row gutter={12}>
                            <Col span={12}>
                              <Form.Item label="Company Name" required>
                                <Controller
                                  name="companyName"
                                  control={ipoForm.control}
                                  rules={{ required: true }}
                                  render={({ field }) => (
                                    <Input value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder="Company Name" />
                                  )}
                                />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item label="Company Code" required>
                                <Controller
                                  name="companyCode"
                                  control={ipoForm.control}
                                  rules={{ required: true }}
                                  render={({ field }) => (
                                    <Input value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder="Company Code" />
                                  )}
                                />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item label="Price Per Unit" required>
                                <Controller
                                  name="pricePerUnit"
                                  control={ipoForm.control}
                                  rules={{ required: true }}
                                  render={({ field }) => (
                                    <InputNumber
                                      value={field.value}
                                      onChange={(value) => field.onChange(Number(value || 0))}
                                      style={{ width: '100%' }}
                                      min={1}
                                      placeholder="Price Per Unit"
                                    />
                                  )}
                                />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item label="District" required>
                                <Controller
                                  name="district"
                                  control={ipoForm.control}
                                  rules={{ required: true }}
                                  render={({ field }) => (
                                    <Select
                                      value={field.value}
                                      onChange={field.onChange}
                                      placeholder="Select District"
                                      options={districtOptions.map((district) => ({ value: district, label: district }))}
                                    />
                                  )}
                                />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item label="Issued Units" required>
                                <Controller
                                  name="issuedUnits"
                                  control={ipoForm.control}
                                  rules={{ required: true }}
                                  render={({ field }) => (
                                    <InputNumber
                                      value={field.value}
                                      onChange={(value) => field.onChange(Number(value || 0))}
                                      style={{ width: '100%' }}
                                      min={1}
                                      placeholder="Issued Units"
                                    />
                                  )}
                                />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item label="Min Units" required>
                                <Controller
                                  name="minUnits"
                                  control={ipoForm.control}
                                  rules={{ required: true }}
                                  render={({ field }) => (
                                    <InputNumber
                                      value={field.value}
                                      onChange={(value) => field.onChange(Number(value || 0))}
                                      style={{ width: '100%' }}
                                      min={1}
                                      placeholder="Min Units"
                                    />
                                  )}
                                />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item label="Max Units" required>
                                <Controller
                                  name="maxUnits"
                                  control={ipoForm.control}
                                  rules={{ required: true }}
                                  render={({ field }) => (
                                    <InputNumber
                                      value={field.value}
                                      onChange={(value) => field.onChange(Number(value || 0))}
                                      style={{ width: '100%' }}
                                      min={1}
                                      placeholder="Max Units"
                                    />
                                  )}
                                />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item label="Status" required>
                                <Controller
                                  name="status"
                                  control={ipoForm.control}
                                  render={({ field }) => (
                                    <Select
                                      value={field.value}
                                      onChange={field.onChange}
                                      style={{ width: '100%' }}
                                      options={[
                                        { value: 'ACTIVE', label: 'Active' },
                                        { value: 'INACTIVE', label: 'Inactive' },
                                      ]}
                                    />
                                  )}
                                />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Button
                            type="primary"
                            loading={savingIpo}
                            style={{ marginTop: 14 }}
                            onClick={() => void ipoForm.handleSubmit(onCreateIpo, onCreateIpoInvalid)()}
                          >
                            Save IPO
                          </Button>
                        </form>
                      </Card>
                    ),
                  },
                ]
              : []),
            {
              key: 'manualEntry',
              label: 'Manual Entry',
              children: (
                <Card title="New IPO Form Entry">
                  <form onSubmit={(event) => event.preventDefault()}>
                    <Row gutter={12}>
                      <Col span={8}>
                        <Form.Item label="Form No" required>
                          <Controller
                            name="formNo"
                            control={entryForm.control}
                            rules={{ required: true }}
                            render={({ field }) => (
                              <Input value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder="Form No" />
                            )}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Date (BS)" required>
                          <Controller
                            name="dateBs"
                            control={entryForm.control}
                            rules={{ required: true }}
                            render={({ field }) => (
                              <DatePicker
                                value={parseDateBsToDayjs(field.value)}
                                onChange={(date) => field.onChange(date ? date.format('D/M/YYYY') : '')}
                                format="D/M/YYYY"
                                style={{ width: '100%' }}
                                placeholder="dd/mm/yyyy"
                              />
                            )}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="BOID" required>
                          <Controller
                            name="boid"
                            control={entryForm.control}
                            rules={{ required: true }}
                            render={({ field }) => (
                              <Input value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder="BOID (16 digit)" maxLength={16} />
                            )}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Name" required>
                          <Controller
                            name="name"
                            control={entryForm.control}
                            rules={{ required: true }}
                            render={({ field }) => (
                              <Input value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder="Applicant Name" />
                            )}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Father Name" required>
                          <Controller
                            name="fatherName"
                            control={entryForm.control}
                            rules={{ required: true }}
                            render={({ field }) => (
                              <Input value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder="Father Name" />
                            )}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Grandfather/Spouse Name" required>
                          <Controller
                            name="grandfatherName"
                            control={entryForm.control}
                            rules={{ required: true }}
                            render={({ field }) => (
                              <Input value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder="Grandfather/Spouse Name" />
                            )}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Citizenship No" required>
                          <Controller
                            name="citizenshipNo"
                            control={entryForm.control}
                            rules={{ required: true }}
                            render={({ field }) => (
                              <Input value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder="Citizenship No" />
                            )}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Bank Name" required>
                          <Controller
                            name="bankName"
                            control={entryForm.control}
                            rules={{ required: true }}
                            render={({ field }) => (
                              <Select
                                value={field.value || undefined}
                                onChange={field.onChange}
                                showSearch
                                placeholder="Select Bank"
                                options={banks.map((bank) => ({ value: bank, label: bank }))}
                                filterOption={(input, option) => (option?.label || '').toLowerCase().includes(input.toLowerCase())}
                              />
                            )}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Account No" required>
                          <Controller
                            name="accountNo"
                            control={entryForm.control}
                            rules={{ required: true }}
                            render={({ field }) => (
                              <Input value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder="Account No" />
                            )}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Mobile No" required>
                          <Controller
                            name="mobileNo"
                            control={entryForm.control}
                            rules={{ required: true }}
                            render={({ field }) => (
                              <Input value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder="Mobile No" />
                            )}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Units Applied" required>
                          <Controller
                            name="appliedUnits"
                            control={entryForm.control}
                            rules={{ required: true }}
                            render={({ field }) => (
                              <InputNumber
                                value={field.value}
                                onChange={(value) => field.onChange(Number(value || 0))}
                                style={{ width: '100%' }}
                                min={1}
                                placeholder="Units Applied"
                              />
                            )}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="PAN No / Email">
                          <Controller
                            name="panNo"
                            control={entryForm.control}
                            render={({ field }) => (
                              <Input value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder="PAN No / Email" />
                            )}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={24}>
                        <Form.Item label="Remarks">
                          <Controller
                            name="remarks"
                            control={entryForm.control}
                            render={({ field }) => (
                              <Input.TextArea value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder="Remarks" rows={2} />
                            )}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Button
                      type="primary"
                      loading={savingEntry}
                      style={{ marginTop: 8 }}
                      onClick={() => void entryForm.handleSubmit(onCreateEntry, onCreateEntryInvalid)()}
                    >
                      Save Entry
                    </Button>
                  </form>
                </Card>
              ),
            },
            {
              key: 'bulk',
              label: 'Excel Upload',
              children: (
                <Card title="Bulk Entry Upload">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Dragger beforeUpload={(file) => void onUploadEntryExcel(file)} showUploadList={false} accept=".xlsx,.xls">
                      <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                      <p>Drop entry Excel here or click to upload</p>
                    </Dragger>
                    <Dragger beforeUpload={(file) => void onUploadAllotment(file)} showUploadList={false} accept=".xlsx,.xls">
                      <p className="ant-upload-drag-icon"><UploadOutlined /></p>
                      <p>Drop allotment Excel here (Admin)</p>
                    </Dragger>
                  </Space>
                </Card>
              ),
            },
            {
              key: 'entries',
              label: 'Entries List',
              children: (
                <Card
                  title="Entered Applications"
                  extra={
                    <Space>
                      <Button onClick={onExportEntries}>Export Entries</Button>
                      <Button onClick={onExportRefund}>Export Refund</Button>
                      {session.role === 'ADMIN' && (
                        <Popconfirm title="Send allotment emails now?" onConfirm={() => void onSendAllotmentEmails()}>
                          <Button icon={<SendOutlined />} type="primary">Send Emails</Button>
                        </Popconfirm>
                      )}
                    </Space>
                  }
                >
                  <Table<IpoEntry>
                    rowKey="id"
                    size="small"
                    dataSource={entries}
                    scroll={{ x: 1600 }}
                    columns={[
                      { title: 'Form No', dataIndex: 'formNo' },
                      { title: 'Date', dataIndex: 'dateBs' },
                      { title: 'BOID', dataIndex: 'boid' },
                      { title: 'Name', dataIndex: 'name' },
                      { title: 'Father', dataIndex: 'fatherName' },
                      { title: 'Grandfather/Spouse', dataIndex: 'grandfatherName' },
                      { title: 'Bank', dataIndex: 'bankName' },
                      { title: 'Account', dataIndex: 'accountNo' },
                      { title: 'Mobile', dataIndex: 'mobileNo' },
                      { title: 'Applied', dataIndex: 'appliedUnits' },
                      { title: 'Deposit', dataIndex: 'depositAmount' },
                      { title: 'District', dataIndex: 'district' },
                    ]}
                  />
                </Card>
              ),
            },
            ...(session.role === 'ADMIN'
              ? [
                  {
                    key: 'users',
                    label: 'Users',
                    children: (
                      <Card title="User Management">
                        <form onSubmit={(event) => event.preventDefault()}>
                          <Row gutter={12}>
                            <Col span={8}>
                              <Form.Item label="Full Name" required>
                                <Controller
                                  name="fullName"
                                  control={userForm.control}
                                  rules={{ required: true }}
                                  render={({ field }) => (
                                    <Input value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder="Full Name" />
                                  )}
                                />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item label="Email" required>
                                <Controller
                                  name="email"
                                  control={userForm.control}
                                  rules={{ required: true }}
                                  render={({ field }) => (
                                    <Input value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder="Email" />
                                  )}
                                />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item label="Password" required>
                                <Controller
                                  name="password"
                                  control={userForm.control}
                                  rules={{ required: true }}
                                  render={({ field }) => (
                                    <Input.Password value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder="Password" />
                                  )}
                                />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item label="Role" required>
                                <Controller
                                  name="role"
                                  control={userForm.control}
                                  render={({ field }) => (
                                    <Select
                                      value={field.value}
                                      onChange={field.onChange}
                                      options={[
                                        { value: 'ADMIN', label: 'Admin' },
                                        { value: 'STAFF', label: 'Staff' },
                                      ]}
                                    />
                                  )}
                                />
                              </Form.Item>
                            </Col>
                            <Col span={8} style={{ display: 'flex', alignItems: 'end' }}>
                              <Button type="primary" loading={savingUser} onClick={() => void userForm.handleSubmit(onCreateUser, onCreateUserInvalid)()}>Create User</Button>
                            </Col>
                          </Row>
                        </form>

                        <Table
                          style={{ marginTop: 16 }}
                          rowKey="id"
                          dataSource={users}
                          columns={[
                            { title: 'Name', dataIndex: 'fullName' },
                            { title: 'Email', dataIndex: 'email' },
                            { title: 'Role', dataIndex: 'role' },
                            {
                              title: 'Status',
                              dataIndex: 'isActive',
                              render: (value: boolean) => <Tag color={value ? 'green' : 'red'}>{value ? 'Active' : 'Inactive'}</Tag>,
                            },
                          ]}
                        />
                      </Card>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Content>
    </Layout>
  );
}

const WrappedApp = () => (
  <AntApp>
    <App />
  </AntApp>
);

export default WrappedApp;
