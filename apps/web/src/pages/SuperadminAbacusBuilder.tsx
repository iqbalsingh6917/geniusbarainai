import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import {
  fetchAbacusLevels,
  createAbacusLevel,
  updateAbacusLevel,
  AbacusLevel,
  AbacusLevelPayload,
  Difficulty,
  AgeGroup,
} from '../api/abacusLevelsClient';
import {
  listCourses,
  listModules,
  createCourse as apiCreateCourse,
  updateCourse as apiUpdateCourse,
  createModule as apiCreateModule,
  updateModule as apiUpdateModule,
  AbacusCoursePayload,
  AbacusModulePayload,
} from '../api/abacusCoursesClient';

type Course = { id: number; code: string; name: string; variant: string; description?: string | null };
type Module = { id: number; title: string; courseId: number; index: number };

const difficultyOptions: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
const ageGroupOptions: AgeGroup[] = ['JUNIOR', 'REGULAR', 'SENIOR'];
const operationOptions = ['ADD', 'SUB', 'MUL', 'DIV'];
const formulaOptions = ['SMALL_FRIENDS', 'BIG_FRIENDS', 'COMPLEMENTS', 'CARRY', 'BORROW'];

const SuperadminAbacusBuilder: React.FC = () => {
  const { showToast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [selectedModule, setSelectedModule] = useState<number | null>(null);
  const [levels, setLevels] = useState<AbacusLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AbacusLevel | null>(null);
  const [courseDraft, setCourseDraft] = useState<AbacusCoursePayload>({
    code: '',
    name: '',
    variant: 'REGULAR',
    description: '',
  });
  const [moduleDraft, setModuleDraft] = useState<AbacusModulePayload>({
    title: '',
    index: 1,
  });

  const [form, setForm] = useState<AbacusLevelPayload>({
    courseId: 0,
    moduleId: null,
    name: '',
    code: '',
    difficulty: 'EASY',
    ageGroup: 'REGULAR',
    operations: ['ADD', 'SUB'],
    formulas: [],
    examDurationMin: 30,
    maxMarks: 100,
    passingPercent: 60,
    isActive: true,
  });

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      loadModules(selectedCourse);
      loadLevels(selectedCourse, selectedModule || undefined);
      setForm((f) => ({ ...f, courseId: selectedCourse }));
    }
  }, [selectedCourse, selectedModule]);

  const loadCourses = async () => {
    try {
      const res = await listCourses();
      setCourses(res ?? []);
      if (res && res.length > 0) {
        setSelectedCourse((current) => current ?? res[0].id);
      }
    } catch (err) {
      showToast('Failed to load courses', 'error');
    }
  };

  const loadModules = async (courseId: number) => {
    try {
      const res = await listModules(courseId);
      setModules(res ?? []);
      if (res && res.length > 0) {
        setSelectedModule(res[0].id);
      } else {
        setSelectedModule(null);
      }
      setModuleDraft((current) => ({
        ...current,
        index: res && res.length > 0 ? Math.max(...res.map((m) => m.index)) + 1 : 1,
      }));
    } catch (err) {
      showToast('Failed to load modules', 'error');
    }
  };

  const loadLevels = async (courseId: number, moduleId?: number) => {
    try {
      setLoading(true);
      const data = await fetchAbacusLevels(courseId, moduleId);
      setLevels(data ?? []);
    } catch (err) {
      showToast('Failed to load levels', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      courseId: selectedCourse || 0,
      moduleId: selectedModule,
      name: '',
      code: '',
      difficulty: 'EASY',
      ageGroup: 'REGULAR',
      operations: ['ADD', 'SUB'],
      formulas: [],
      examDurationMin: 30,
      maxMarks: 100,
      passingPercent: 60,
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEdit = (level: AbacusLevel) => {
    setEditing(level);
    setForm({
      courseId: selectedCourse || 0,
      moduleId: level.moduleId,
      name: level.name,
      code: level.code,
      difficulty: level.difficulty,
      ageGroup: (level.ageGroup as AgeGroup) || 'REGULAR',
      operations: Array.isArray(level.operations)
        ? (level.operations as string[])
        : String(level.operations || '')
            .split(',')
            .filter(Boolean),
      formulas: Array.isArray(level.formulas)
        ? (level.formulas as string[])
        : String(level.formulas || '')
            .split(',')
            .filter(Boolean),
      examDurationMin: level.examDurationMin,
      maxMarks: level.maxMarks ?? 100,
      passingPercent: level.passingPercent,
      isActive: level.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!selectedCourse) {
        showToast('Select a course', 'error');
        return;
      }
      const requestedModuleId = form.moduleId ?? selectedModule ?? null;
      const validModuleId =
        requestedModuleId && modules.some((m) => m.id === requestedModuleId && m.courseId === selectedCourse)
          ? requestedModuleId
          : modules.find((m) => m.courseId === selectedCourse)?.id ?? null;

      if (!validModuleId) {
        showToast('Select a module for this course', 'error');
        return;
      }

      const payload = { ...form, courseId: selectedCourse, moduleId: validModuleId };
      if (editing) {
        await updateAbacusLevel(editing.id, payload);
        showToast('Level updated', 'success');
      } else {
        await createAbacusLevel(payload);
        showToast('Level created', 'success');
      }
      setModalOpen(false);
      loadLevels(selectedCourse, selectedModule || undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save level';
      showToast(message, 'error');
    }
  };

  const levelRows = useMemo(() => {
    return levels.map((l) => ({
      ...l,
      moduleName: modules.find((m) => m.id === l.moduleId)?.title || '-',
    }));
  }, [levels, modules]);

  const handleCreateCourse = async () => {
    if (!courseDraft.code.trim() || !courseDraft.name.trim() || !courseDraft.variant.trim()) {
      showToast('Course code, name, and variant are required', 'error');
      return;
    }
    const payload: AbacusCoursePayload = {
      code: courseDraft.code.trim(),
      name: courseDraft.name.trim(),
      variant: courseDraft.variant.trim(),
      description: courseDraft.description?.trim() || null,
    };
    try {
      const created = await apiCreateCourse(payload);
      await loadCourses();
      setSelectedCourse(created?.id ?? null);
      setCourseDraft({ code: '', name: '', variant: 'REGULAR', description: '' });
      showToast('Course created', 'success');
    } catch (err: any) {
      const message = err?.message || 'Failed to create course';
      showToast(message, 'error');
    }
  };

  const handleEditCourse = async () => {
    if (!selectedCourse) {
      showToast('Select a course first', 'error');
      return;
    }
    const course = courses.find((c) => c.id === selectedCourse);
    if (!course) return;
    const name = window.prompt('Course name?', course.name) ?? course.name;
    const variant = window.prompt('Course variant?', course.variant) ?? course.variant;
    const description = window.prompt('Description?', (course as any).description || '') ?? ((course as any).description || undefined);
    try {
      await apiUpdateCourse(selectedCourse, { name, variant, description });
      await loadCourses();
      showToast('Course updated', 'success');
    } catch {
      showToast('Failed to update course', 'error');
    }
  };

  const handleCreateModule = async () => {
    if (!selectedCourse) {
      showToast('Select a course first', 'error');
      return;
    }
    if (!moduleDraft.title.trim()) {
      showToast('Module title is required', 'error');
      return;
    }
    const index = Number(moduleDraft.index);
    if (Number.isNaN(index)) {
      showToast('Module index must be a number', 'error');
      return;
    }
    const payload: AbacusModulePayload = { title: moduleDraft.title.trim(), index };
    try {
      const created = await apiCreateModule(selectedCourse, payload);
      await loadModules(selectedCourse);
      setSelectedModule(created?.id ?? null);
      setModuleDraft((current) => ({
        ...current,
        title: '',
        index: index + 1,
      }));
      showToast('Module created', 'success');
    } catch (err: any) {
      const message = err?.message || 'Failed to create module';
      showToast(message, 'error');
    }
  };

  const handleEditModule = async () => {
    if (!selectedModule) {
      showToast('Select a module first', 'error');
      return;
    }
    const module = modules.find((m) => m.id === selectedModule);
    if (!module) return;
    const title = window.prompt('Module title?', module.title) ?? module.title;
    const indexValue = window.prompt('Module index?', String(module.index)) ?? String(module.index);
    const index = Number(indexValue);
    if (Number.isNaN(index)) {
      showToast('Module index must be a number', 'error');
      return;
    }
    try {
      await apiUpdateModule(selectedModule, { title, index });
      if (selectedCourse) {
        await loadModules(selectedCourse);
      }
      showToast('Module updated', 'success');
    } catch {
      showToast('Failed to update module', 'error');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Abacus Curriculum Builder</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          Add Level
        </button>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-600">Course</label>
            <select
              className="select select-bordered w-full"
              value={selectedCourse || ''}
              onChange={(e) => {
                setSelectedCourse(Number(e.target.value));
                setSelectedModule(null);
              }}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            <div className="flex gap-2 mt-2">
              <div className="flex flex-col gap-2 flex-1">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="input input-bordered w-full"
                    placeholder="Course code"
                    value={courseDraft.code}
                    onChange={(e) => setCourseDraft({ ...courseDraft, code: e.target.value })}
                  />
                  <input
                    className="input input-bordered w-full"
                    placeholder="Course name"
                    value={courseDraft.name}
                    onChange={(e) => setCourseDraft({ ...courseDraft, name: e.target.value })}
                  />
                  <input
                    className="input input-bordered w-full"
                    placeholder="Variant (e.g., REGULAR)"
                    value={courseDraft.variant}
                    onChange={(e) => setCourseDraft({ ...courseDraft, variant: e.target.value })}
                  />
                  <input
                    className="input input-bordered w-full"
                    placeholder="Description (optional)"
                    value={courseDraft.description ?? ''}
                    onChange={(e) => setCourseDraft({ ...courseDraft, description: e.target.value })}
                  />
                </div>
                <button className="btn btn-secondary btn-xs self-start" onClick={handleCreateCourse}>
                  Add Course
                </button>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={handleEditCourse}>
                Edit Course
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600">Module</label>
            <select
              className="select select-bordered w-full"
              value={selectedModule || ''}
              onChange={(e) => setSelectedModule(Number(e.target.value))}
            >
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} (#{m.index})
                </option>
              ))}
            </select>
            <div className="flex gap-2 mt-2">
              <div className="flex flex-col gap-2 flex-1">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="input input-bordered w-full"
                    placeholder="Module title"
                    value={moduleDraft.title}
                    onChange={(e) => setModuleDraft({ ...moduleDraft, title: e.target.value })}
                  />
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    placeholder="Index"
                    value={moduleDraft.index}
                    onChange={(e) => setModuleDraft({ ...moduleDraft, index: Number(e.target.value) })}
                  />
                </div>
                <button className="btn btn-secondary btn-xs self-start" onClick={handleCreateModule}>
                  Add Module
                </button>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={handleEditModule}>
                Edit Module
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Module</th>
                <th>Difficulty</th>
                <th>Age</th>
                <th>Ops</th>
                <th>Formulas</th>
                <th>Exam (min)</th>
                <th>Max Marks</th>
                <th>Pass %</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={12} className="text-center py-4">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && levelRows.length === 0 && (
                <tr>
                  <td colSpan={12} className="text-center py-4 text-gray-500">
                    No levels found.
                  </td>
                </tr>
              )}
              {!loading &&
                levelRows.map((lvl) => (
                  <tr key={lvl.id}>
                    <td>{lvl.name}</td>
                    <td>{lvl.code}</td>
                    <td>{lvl.moduleName}</td>
                    <td>{lvl.difficulty}</td>
                    <td>{lvl.ageGroup || '-'}</td>
                    <td>{Array.isArray(lvl.operations) ? lvl.operations.join(', ') : String(lvl.operations || '')}</td>
                    <td>{Array.isArray(lvl.formulas) ? lvl.formulas.join(', ') : String(lvl.formulas || '')}</td>
                    <td>{lvl.examDurationMin}</td>
                    <td>{lvl.maxMarks ?? '-'}</td>
                    <td>{lvl.passingPercent}</td>
                    <td>{lvl.isActive ? 'Active' : 'Inactive'}</td>
                    <td>
                      <button className="btn btn-secondary btn-xs" onClick={() => openEdit(lvl)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3 className="text-lg font-semibold">{editing ? 'Edit Level' : 'Add Level'}</h3>
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                Close
              </button>
            </div>
            <form className="modal-body space-y-3" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600">Name</label>
                  <input
                    className="input input-bordered w-full"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Code</label>
                  <input
                    className="input input-bordered w-full"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Module</label>
                  <select
                    className="select select-bordered w-full"
                    value={form.moduleId ?? selectedModule ?? ''}
                    onChange={(e) => setForm({ ...form, moduleId: Number(e.target.value) })}
                  >
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title} (#{m.index})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Difficulty</label>
                  <select
                    className="select select-bordered w-full"
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: e.target.value as Difficulty })}
                  >
                    {difficultyOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Age Group</label>
                  <select
                    className="select select-bordered w-full"
                    value={form.ageGroup}
                    onChange={(e) => setForm({ ...form, ageGroup: e.target.value as AgeGroup })}
                  >
                    {ageGroupOptions.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Exam Duration (minutes)</label>
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    value={form.examDurationMin}
                    onChange={(e) => setForm({ ...form, examDurationMin: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Max Marks</label>
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    value={form.maxMarks ?? 0}
                    onChange={(e) => setForm({ ...form, maxMarks: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Pass %</label>
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    value={form.passingPercent}
                    onChange={(e) => setForm({ ...form, passingPercent: Number(e.target.value) })}
                    min={0}
                    max={100}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Status</label>
                  <select
                    className="select select-bordered w-full"
                    value={form.isActive ? 'ACTIVE' : 'INACTIVE'}
                    onChange={(e) => setForm({ ...form, isActive: e.target.value === 'ACTIVE' })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600">Operations</label>
                <div className="flex flex-wrap gap-2">
                  {operationOptions.map((op) => {
                    const checked = form.operations.includes(op);
                    return (
                      <label key={op} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (checked) {
                              setForm({ ...form, operations: form.operations.filter((o) => o !== op) });
                            } else {
                              setForm({ ...form, operations: [...form.operations, op] });
                            }
                          }}
                        />
                        {op}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600">Formulas</label>
                <div className="flex flex-wrap gap-2">
                  {formulaOptions.map((fo) => {
                    const checked = form.formulas.includes(fo);
                    return (
                      <label key={fo} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (checked) {
                              setForm({ ...form, formulas: form.formulas.filter((f) => f !== fo) });
                            } else {
                              setForm({ ...form, formulas: [...form.formulas, fo] });
                            }
                          }}
                        />
                        {fo}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperadminAbacusBuilder;
